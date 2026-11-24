"""Backtest the risk rules against verified NH-44 incidents (BUILD_PROMPT A8).

For each verified incident in data/incidents.csv:

- Forecast check (events from 1 Feb 2024, when archived forecasts start):
  score the incident's zone at the event time T the way the hourly job would
  have done 48, 24 and 12 hours earlier, using the forecasts Open-Meteo had
  then. Hit = the zone is medium or high.
- Weather on the day (every event): the same rules on what the weather
  actually was (ERA5). Says whether the rules recognise the weather that came
  with the closure, not whether they predicted it.

Plus false alarms: every day from 1 Feb 2024, every zone, scored with the
forecast from a day earlier; an alarm day is medium or high with no verified
incident in that zone within a day.

Writes lib/risk/backtest.json (read by GET /api/v1/model) and
docs/backtest.md. With 0 verified incidents it writes status "not_run" and
the reason. Unverified rows are never used, except with
--preview-unverified, which only prints and never writes.

Usage
  python jobs/backtest.py                       # verified rows -> json + md
  python jobs/backtest.py --dry-run             # print, write nothing
  python jobs/backtest.py --preview-unverified  # pipeline check, print only
"""

from __future__ import annotations

import argparse
import bisect
import csv
import json
import statistics
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from risk.config import HAZARDS, REPO_ROOT, load_config
from risk.history import FORECASTS_FROM, Fetcher
from risk.openmeteo import WeatherFetchError
from risk.scoring import build_row, pick_hazards
from risk.triggers import all_triggers
from risk.weather import DataGapError, Hour, Series

JOBS = Path(__file__).resolve().parent
INCIDENTS_CSV = REPO_ROOT / "data" / "incidents.csv"
OUT_JSON = REPO_ROOT / "lib" / "risk" / "backtest.json"
OUT_MD = REPO_ROOT / "docs" / "backtest.md"

EVENT_HOUR_UTC = 6  # 12:00 IST is 06:30 UTC; the hourly series has 06:00
LEADS = {48: 2, 24: 1, 12: 0}  # lead hours -> forecast made N days before each hour
LOOKBACK_H = 96  # longest trigger window is 72 h; a day of margin
RIGHT_HAZARD_MIN = 0.30  # same as the "medium" cut-off
ALARM_LEVELS = ("medium", "high")
FA_LEAD_DAYS = 1  # false alarms use the forecast from a day earlier

CAVEATS = [
    "The incident list is incomplete, so some 'false alarms' are probably real closures or slowdowns nobody wrote down. Read the false-alarm count as an upper bound.",
    "Sources give a date, not a time, so every event is scored at 12:00 IST on its date.",
    "Each forecast hour uses the run made about 1 or 2 days before that hour, which is a little worse than what the job would have had live.",
    "The 12 h lead uses the newest archived run for the hours ahead, which is closer than 12 h for some hours, so it is optimistic.",
    "Archived forecasts have no snow depth for earlier runs; snow depth is held at its value when the forecast was made.",
    "Archived forecasts start on 1 February 2024; older events only get the weather-on-the-day check.",
    "Every threshold is our own starting value, not a sourced figure.",
    "There are few verified incidents, so one event changes the hit rate a lot.",
]


@dataclass(frozen=True)
class Incident:
    id: str
    day: date
    zone_id: int
    hazard: str
    place: str

    @property
    def t(self) -> datetime:
        return datetime(self.day.year, self.day.month, self.day.day, EVENT_HOUR_UTC, tzinfo=timezone.utc)


def load_incidents(path: Path, include_unverified: bool = False) -> tuple[list[Incident], str | None]:
    """Verified, non-demo incidents. With 0 rows, also the reason."""
    if not path.exists():
        return [], f"{path.name} not found"
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        cols = set(reader.fieldnames or [])
        rows = list(reader)
    date_col = "event_start_date" if "event_start_date" in cols else ("date" if include_unverified else None)
    if date_col is None:
        return [], "incidents.csv has no event_start_date column yet (the verified list comes with B1)"
    if not include_unverified and "verified_by" not in cols:
        return [], "incidents.csv has no verified_by column yet (the verified list comes with B1)"
    out = []
    for i, r in enumerate(rows, start=1):
        if not include_unverified and not (r.get("verified_by") or "").strip():
            continue
        if (r.get("is_demo") or "").strip().lower() in ("true", "1", "yes"):
            continue
        if r.get("hazard_type") not in HAZARDS or not (r.get("zone_id") or "").strip():
            continue
        out.append(Incident(
            id=(r.get("id") or str(i)).strip(),
            day=date.fromisoformat(r[date_col].strip()),
            zone_id=int(r["zone_id"]),
            hazard=r["hazard_type"],
            place=(r.get("place") or "").strip(),
        ))
    if not out:
        return [], "no verified incidents in incidents.csv yet"
    return out, None


# --- building the series the job would have had --------------------------------
def forecast_view(day0: Series, dayn: Series, issue: datetime, t: datetime) -> Series:
    """Weather as known at `issue`, for scoring at `t`: hours up to `issue` from
    the newest run (already happened), later hours from the forecast made
    days before. Snow depth for later hours stays at its value at `issue`."""
    start = t - timedelta(hours=LOOKBACK_H)
    depth = day0.at(issue).snow_depth_m
    hours = [h for h in _slice(day0, start, issue)]
    for h in _slice(dayn, issue, t):
        if h.time > issue:
            hours.append(Hour(h.time, h.precip_mm, h.snowfall_cm, depth, h.temp_c))
    return Series(hours)


def _slice(s: Series, start: datetime, end: datetime) -> list[Hour]:
    times = [h.time for h in s.hours]
    return s.hours[bisect.bisect_left(times, start): bisect.bisect_right(times, end)]


def complete(s: Series, t: datetime) -> bool:
    """Every hour in the lookback window has rain, snowfall and temperature."""
    try:
        window = s.window(t, LOOKBACK_H)
    except DataGapError:
        return False
    return len(window) == LOOKBACK_H and all(
        h.precip_mm is not None and h.snowfall_cm is not None and h.temp_c is not None for h in window)


def score_zone(zone_id: int, series_by_point: dict[str, Series], t: datetime, horizon_h: int,
               names: dict[str, str], cfg: dict[str, Any]) -> dict[str, Any]:
    triggers = {pid: all_triggers(s, t, cfg) for pid, s in series_by_point.items()}
    picks = pick_hazards(zone_id, triggers, names, cfg)
    row = build_row(zone_id=zone_id, horizon_h=horizon_h, picks=picks, cfg=cfg,
                    history=set(), reports=[], now=t, run_at=t)
    return {"overall": row["overall"], "level": row["level"], "top_hazard": row["top_hazard"],
            "scores": {h: row[h] for h in HAZARDS}}


def is_alarm(result: dict[str, Any]) -> bool:
    return result["level"] in ALARM_LEVELS


# --- per incident ----------------------------------------------------------------
def check_incident(inc: Incident, points: list[dict[str, Any]], fetcher: Fetcher, cfg: dict[str, Any]) -> dict[str, Any]:
    zone_points = [p for p in points if p["zone_id"] == inc.zone_id]
    names = {p["id"]: p["name"] for p in zone_points}
    start, end = inc.day - timedelta(days=6), inc.day + timedelta(days=1)
    out: dict[str, Any] = {"id": inc.id, "date": inc.day.isoformat(), "zone_id": inc.zone_id,
                           "place": inc.place, "hazard": inc.hazard}

    archive = {p["id"]: fetcher.archive(p, start, end) for p in zone_points}
    if all(complete(s, inc.t) for s in archive.values()):
        r = score_zone(inc.zone_id, archive, inc.t, 0, names, cfg)
        out["on_the_day"] = {**_brief(r, inc.hazard)}
    else:
        out["on_the_day"] = None

    out["forecast"] = {str(lead): None for lead in LEADS}
    if inc.day >= FORECASTS_FROM + timedelta(days=5):
        runs = {p["id"]: fetcher.previous_runs(p, start, end) for p in zone_points}
        for lead, days_before in LEADS.items():
            issue = inc.t - timedelta(hours=lead)
            try:
                views = {pid: forecast_view(r[0], r[days_before], issue, inc.t) for pid, r in runs.items()}
            except DataGapError:
                continue
            if all(complete(v, inc.t) for v in views.values()):
                out["forecast"][str(lead)] = _brief(score_zone(inc.zone_id, views, inc.t, lead, names, cfg), inc.hazard)
    hits = [lead for lead in LEADS if (f := out["forecast"][str(lead)]) and f["hit"]]
    out["lead_time_h"] = max(hits) if hits else None
    return out


def _brief(r: dict[str, Any], hazard: str) -> dict[str, Any]:
    return {"overall": r["overall"], "level": r["level"], "top_hazard": r["top_hazard"],
            "hazard_score": r["scores"][hazard], "hit": is_alarm(r),
            "right_hazard": r["scores"][hazard] >= RIGHT_HAZARD_MIN}


# --- false alarms ----------------------------------------------------------------
def false_alarms(points: list[dict[str, Any]], incidents: list[Incident], fetcher: Fetcher,
                 cfg: dict[str, Any], start: date, end: date) -> dict[str, Any]:
    """Alarm days per zone with the forecast from FA_LEAD_DAYS earlier, at 12:00 IST."""
    names = {p["id"]: p["name"] for p in points}
    runs = {p["id"]: fetcher.previous_runs(p, start - timedelta(days=6), end) for p in points}
    near = {(i.zone_id, i.day + timedelta(days=k)) for i in incidents for k in (-1, 0, 1)}
    per_zone: dict[str, dict[str, int]] = {}
    for zone_id in sorted({p["zone_id"] for p in points}):
        zp = [p["id"] for p in points if p["zone_id"] == zone_id]
        alarm_days = scored = 0
        day = start
        while day <= end:
            t = datetime(day.year, day.month, day.day, EVENT_HOUR_UTC, tzinfo=timezone.utc)
            issue = t - timedelta(days=FA_LEAD_DAYS)
            try:
                views = {pid: forecast_view(runs[pid][0], runs[pid][FA_LEAD_DAYS], issue, t) for pid in zp}
            except DataGapError:
                views = {}
            if views and all(complete(v, t) for v in views.values()):
                scored += 1
                r = score_zone(zone_id, views, t, 24 * FA_LEAD_DAYS, {k: names[k] for k in zp}, cfg)
                if is_alarm(r) and (zone_id, day) not in near:
                    alarm_days += 1
            day += timedelta(days=1)
        per_zone[str(zone_id)] = {"alarm_days": alarm_days, "days_scored": scored}
    total_alarms = sum(z["alarm_days"] for z in per_zone.values())
    total_days = sum(z["days_scored"] for z in per_zone.values())
    return {
        "from": start.isoformat(), "to": end.isoformat(),
        "lead_h": 24 * FA_LEAD_DAYS,
        "per_zone": per_zone,
        "alarm_days": total_alarms,
        "zone_days_scored": total_days,
        "alarm_days_per_zone_per_30_days": round(30 * total_alarms / total_days, 1) if total_days else None,
    }


# --- summary ---------------------------------------------------------------------
def summarise(results: list[dict[str, Any]]) -> dict[str, Any]:
    def rate(key: str | None, field: str) -> dict[str, int]:
        checks = [r["on_the_day"] if key is None else r["forecast"][key] for r in results]
        checks = [c for c in checks if c]
        return {"hits": sum(1 for c in checks if c[field]), "of": len(checks)}

    leads = [r["lead_time_h"] for r in results if r["lead_time_h"] is not None]
    return {
        "hit_rate": {**{f"{k}h": rate(str(k), "hit") for k in LEADS}, "on_the_day": rate(None, "hit")},
        "right_hazard": {**{f"{k}h": rate(str(k), "right_hazard") for k in LEADS},
                         "on_the_day": rate(None, "right_hazard")},
        "median_lead_time_h": statistics.median(leads) if leads else None,
    }


def last_full_month_end(today: date) -> date:
    return today.replace(day=1) - timedelta(days=1)


def build_report(incidents: list[Incident], reason: str | None, points: list[dict[str, Any]],
                 fetcher: Fetcher, cfg: dict[str, Any], today: date, preview: bool = False) -> dict[str, Any]:
    base = {
        "preview_unverified": preview,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "model_version": cfg["model_version"],
        "method": {
            "event_time": "12:00 IST on the event date",
            "hit": "zone level medium or high (overall >= 0.30)",
            "right_hazard": "the incident's hazard scores >= 0.30",
            "leads_h": list(LEADS),
            "forecasts": "Open-Meteo Previous Runs API (forecast made 2, 1 or 0 days before each hour), from 2024-02-01",
            "on_the_day": "Open-Meteo Archive API (ERA5): the weather that actually happened",
            "false_alarm": "medium or high with no verified incident in that zone within 1 day, forecast from 1 day earlier",
        },
        "caveats": CAVEATS,
    }
    if not incidents:
        return {"status": "not_run", "reason": reason, **base}
    results = [check_incident(i, points, fetcher, cfg) for i in incidents]
    fa = false_alarms(points, incidents, fetcher, cfg, FORECASTS_FROM + timedelta(days=5), last_full_month_end(today))
    return {
        "status": "ok", **base,
        "incidents": {"count": len(incidents), "verified": not preview,
                      "with_forecasts": sum(1 for r in results if any(r["forecast"].values())),
                      "from": min(i.day for i in incidents).isoformat(),
                      "to": max(i.day for i in incidents).isoformat()},
        **summarise(results),
        "false_alarms": fa,
        "per_incident": results,
    }


def render_md(report: dict[str, Any]) -> str:
    """docs/backtest.md from the report. Only numbers from the report."""
    m = report["method"]
    lines = [
        "# Backtest",
        "",
    ]
    if report.get("preview_unverified"):
        lines += ["**PREVIEW ON UNVERIFIED ROWS. NOT VERIFIED, DON'T QUOTE THESE NUMBERS.**", ""]
    lines += [
        "Generated by `python jobs/backtest.py` from `data/incidents.csv` (verified rows only). "
        "Don't edit by hand; rerun the script. RouteGuard is advisory and not an official police service.",
        "",
        f"Model `{report['model_version']}`, generated {report['generated_at']}.",
        "",
    ]
    if report["status"] != "ok":
        lines += [f"**Not run yet: {report['reason']}.**", "",
                  "When the verified incident list is merged, run `python jobs/backtest.py` and commit "
                  "`lib/risk/backtest.json` and this file.", ""]
    else:
        inc = report["incidents"]
        lines += [
            f"{inc['count']} {'verified' if inc['verified'] else 'UNVERIFIED'} incidents from {inc['from']} to {inc['to']}; "
            f"{inc['with_forecasts']} of them are recent enough for archived forecasts.", "",
            "## Hits", "",
            "| Check | Zone flagged (medium or high) | Right hazard flagged |",
            "| --- | --- | --- |",
        ]
        for key in [f"{k}h" for k in LEADS] + ["on_the_day"]:
            label = "Weather on the day (ERA5)" if key == "on_the_day" else f"Forecast {key.removesuffix('h')} h ahead"
            h, rh = report["hit_rate"][key], report["right_hazard"][key]
            lines.append(f"| {label} | {h['hits']} of {h['of']} | {rh['hits']} of {rh['of']} |")
        lt = report["median_lead_time_h"]
        lines += ["", f"Median lead time of the forecast hits: {f'{lt:g} h' if lt is not None else 'none'}.", ""]
        fa = report["false_alarms"]
        per30 = fa["alarm_days_per_zone_per_30_days"]
        lines += [
            "## False alarms", "",
            f"From {fa['from']} to {fa['to']}, forecast {fa['lead_h']} h ahead: {fa['alarm_days']} alarm days "
            f"across {fa['zone_days_scored']} zone-days"
            + (f" (about {per30} per zone per 30 days)." if per30 is not None else "."), "",
            "| Zone | Alarm days | Days scored |", "| --- | --- | --- |",
        ]
        lines += [f"| {z} | {v['alarm_days']} | {v['days_scored']} |" for z, v in fa["per_zone"].items()]
        lines += ["", "## Each incident", "",
                  "| Date | Zone | Place | Hazard | 48 h | 24 h | 12 h | On the day |",
                  "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for r in report["per_incident"]:
            cells = [_cell(r["forecast"][str(k)]) for k in LEADS] + [_cell(r["on_the_day"])]
            lines.append(f"| {r['date']} | {r['zone_id']} | {r['place']} | {r['hazard']} | " + " | ".join(cells) + " |")
        lines.append("")
    lines += ["## Method", ""] + [f"- **{k.replace('_', ' ')}:** {v}" for k, v in m.items()]
    lines += ["", "## Caveats", ""] + [f"- {c}" for c in report["caveats"]] + [""]
    return "\n".join(lines)


def _cell(c: dict[str, Any] | None) -> str:
    if not c:
        return "no data"
    return f"{c['level']} ({c['overall']:.2f})"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Backtest the risk rules against verified incidents.")
    ap.add_argument("--incidents", type=Path, default=INCIDENTS_CSV)
    ap.add_argument("--dry-run", action="store_true", help="print the report, write nothing")
    ap.add_argument("--preview-unverified", action="store_true",
                    help="also use unverified rows to check the pipeline; prints only, never writes")
    args = ap.parse_args(argv)

    cfg = load_config()
    points = json.loads((JOBS / "points.json").read_text())["points"]
    incidents, reason = load_incidents(args.incidents, include_unverified=args.preview_unverified)
    if args.preview_unverified:
        print("=" * 72 + "\nPREVIEW ON UNVERIFIED ROWS. NOT VERIFIED, DON'T QUOTE THESE NUMBERS.\n" + "=" * 72)
    print(f"backtest {cfg['model_version']}: {len(incidents)} incidents" + (f" ({reason})" if reason else ""))

    fetcher = Fetcher()
    try:
        report = build_report(incidents, reason, points, fetcher, cfg, datetime.now(timezone.utc).date(),
                              preview=args.preview_unverified)
    except WeatherFetchError as e:
        print(f"ERROR: {e}. Nothing was written.", file=sys.stderr)
        return 1
    md = render_md(report)
    print(md)
    print(f"(Open-Meteo calls this run: {fetcher.calls}; the rest came from jobs/.cache/backtest/)")

    if args.dry_run or args.preview_unverified:
        print("Wrote nothing" + (" (preview)." if args.preview_unverified else " (dry run)."))
        return 0
    OUT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    OUT_MD.write_text(md)
    print(f"Wrote {OUT_JSON.relative_to(REPO_ROOT)} and {OUT_MD.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
