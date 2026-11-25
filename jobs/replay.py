"""Storm replays: the risk map for a real past storm, for demos (BUILD_PROMPT A8).

On a dry day every zone and cell scores 0, so the live map can't show what
RouteGuard does in bad weather. This scores a few verified incidents from
data/incidents.csv the same way the hourly job does (score_all, every zone
and every H3 cell), but on the weather that actually happened then: ERA5
reanalysis from the Open-Meteo archive, the same source as the backtest's
"weather on the day" check.

- Scored at 12:00 IST on the incident date (06:00 UTC, like the backtest).
- The +12, +24 and +48 h maps use the weather that actually came, not a
  forecast. The app says so.
- No database: no past incidents or road reports, so confidence uses
  exposure only, like the backtest.
- Nothing here is written to the live database. The app shows replays only
  behind a "past storm" switch with a banner.

Writes lib/risk/replays.json (served by GET /api/v1/risk/replays).

Usage
  python jobs/replay.py            # fetch (cached in jobs/.cache/), score, write
  python jobs/replay.py --dry-run  # print, write nothing
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from backtest import EVENT_HOUR_UTC, INCIDENTS_CSV
from risk.config import HAZARDS, REPO_ROOT, load_config
from risk.history import Fetcher
from risk.hexes import read_hexes
from risk.openmeteo import WeatherFetchError
from run_risk import DATA_DIR, load_points, score_all
from risk.weather import DataGapError

OUT_JSON = REPO_ROOT / "lib" / "risk" / "replays.json"

# Verified incidents with a clear weather signal, one per kind of storm.
# Each must have verified_by filled in data/incidents.csv.
EVENTS = (
    "inc-2026-01-23-z5-snow_ice",  # heavy snow, Navyug Tunnel (Banihal)
    "inc-2026-04-06-z4-landslide",  # rain, landslides at Digdol and Banihal
    "inc-2025-04-20-z4-flash_flood",  # cloudburst, Seri to Maroog (Ramban)
)

FORMAT = 1  # add 1 when the shape of replays.json changes


def read_incidents(path: Path, ids: tuple[str, ...]) -> list[dict[str, str]]:
    with path.open(newline="") as f:
        rows = {r["id"]: r for r in csv.DictReader(f)}
    out = []
    for i in ids:
        r = rows.get(i)
        if r is None:
            raise SystemExit(f"ERROR: {i} is not in {path.name}")
        if not (r.get("verified_by") or "").strip() or (r.get("is_demo") or "").lower() in ("true", "1", "yes"):
            raise SystemExit(f"ERROR: {i} is not a verified, real incident")
        out.append(r)
    return out


def api_row(row: dict[str, Any]) -> dict[str, Any]:
    """A job row in the shape GET /api/v1/risk returns (src/shared/risk.ts RiskRow)."""
    return {
        "zone_id": row["zone_id"],
        "horizon_hours": row["horizon_hours"],
        "overall": row["overall"],
        "risk_low": row["risk_low"],
        "risk_high": row["risk_high"],
        "level": row["level"],
        "top_hazard": row["top_hazard"],
        "confidence": row["confidence"],
        "hazards": {h: row[h] for h in HAZARDS},
        "reason": row["reason"],
        "reason_code": row["reason_code"],
        "reason_params": row["reason_params"],
    }


def hex_row(row: dict[str, Any], slope: float | None) -> dict[str, Any]:
    """A job row in the shape of HexRow (src/server/risk/risk.repository.ts)."""
    return {
        "h3_index": row["h3_index"],
        "zone_id": row["zone_id"],
        "horizon_hours": row["horizon_hours"],
        **{h: row[h] for h in HAZARDS},
        "overall": row["overall"],
        "level": row["level"],
        "top_hazard": row["top_hazard"],
        "confidence": row["confidence"],
        "reason": row["reason"],
        "reason_code": row["reason_code"],
        "reason_params": row["reason_params"],
        "slope_deg": slope,
    }


def build_event(inc: dict[str, str], points: list[dict[str, Any]], hexes: list[Any], fetcher: Fetcher,
                cfg: dict[str, Any]) -> dict[str, Any]:
    day = datetime.fromisoformat(inc["event_start_date"]).date()
    t = datetime(day.year, day.month, day.day, EVENT_HOUR_UTC, tzinfo=timezone.utc)
    last = t + timedelta(hours=max(cfg["horizons_hours"]))
    weather = {p["id"]: fetcher.archive(p, day - timedelta(days=6), last.date() + timedelta(days=1)) for p in points}
    zone_rows, hex_rows = score_all(points, weather, cfg, t, t, set(), [], hexes)
    slopes = {h.h3_index: h.slope_deg for h in hexes}
    return {
        "id": inc["id"],
        "date": inc["event_start_date"],
        "scored_at": t.isoformat().replace("+00:00", "Z"),
        "zone_id": int(inc["zone_id"]),
        "place": inc["place"],
        "hazard": inc["hazard_type"],
        "source_publisher": inc["source_publisher"],
        "source_url": inc["source_url"],
        "rows": [api_row(r) for r in zone_rows],
        "hexes": [hex_row(r, slopes.get(r["h3_index"])) for r in hex_rows],
    }


def summary(ev: dict[str, Any]) -> str:
    lines = [f"{ev['id']}  {ev['place']}  ({ev['hazard']}, scored {ev['scored_at']})"]
    for h in sorted({r["horizon_hours"] for r in ev["rows"]}):
        zones = " ".join(f"z{r['zone_id']}:{r['level'][0].upper()}{r['overall']:.2f}"
                         for r in ev["rows"] if r["horizon_hours"] == h)
        cells = [x for x in ev["hexes"] if x["horizon_hours"] == h]
        counts = {lv: sum(1 for x in cells if x["level"] == lv) for lv in ("low", "medium", "high")}
        lines.append(f"  +{h:>2} h  {zones}   cells L/M/H {counts['low']}/{counts['medium']}/{counts['high']}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Score past NH-44 storms for the app's replay mode.")
    ap.add_argument("--dry-run", action="store_true", help="print, write nothing")
    args = ap.parse_args(argv)

    cfg = load_config()
    points = load_points()
    hexes = read_hexes(DATA_DIR)
    if not hexes:
        print("ERROR: data/corridor_hexes.csv and data/hex_slope.csv are needed", file=sys.stderr)
        return 1
    fetcher = Fetcher()
    events = []
    for inc in read_incidents(INCIDENTS_CSV, EVENTS):
        try:
            ev = build_event(inc, points, hexes, fetcher, cfg)
        except (WeatherFetchError, DataGapError) as e:
            print(f"ERROR: {inc['id']}: {e}", file=sys.stderr)
            return 1
        print(summary(ev))
        events.append(ev)
    print(f"Open-Meteo archive calls: {fetcher.calls} (the rest from the cache)")

    out = {
        "format": FORMAT,
        "model_version": cfg["model_version"],
        "weather_source": "ERA5 reanalysis via the Open-Meteo archive API",
        "events": events,
    }
    if args.dry_run:
        print("dry run: wrote nothing")
        return 0
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {OUT_JSON.relative_to(REPO_ROOT)} ({OUT_JSON.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
