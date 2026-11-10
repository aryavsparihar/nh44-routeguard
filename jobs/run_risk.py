"""Hourly NH-44 risk job.

1. Fetch Open-Meteo weather for every point in jobs/points.json (one call).
2. Upsert it into weather_readings on (point_id, valid_at).
3. Score the 6 zones for horizons 0/12/24/48 h with the rules in jobs/risk/
   (and every hexagon too, if data/corridor_hexes.csv + data/hex_slope.csv exist).
4. Insert the rows into risk_scores.

Usage
  python jobs/run_risk.py --dry-run   # fetch + score + print, writes nothing, no key needed
  python jobs/run_risk.py             # needs SUPABASE_URL and SUPABASE_SECRET_KEY

Keys come from the environment (GitHub Actions secrets) or a gitignored jobs/.env.
They are never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from risk.config import REPO_ROOT, load_config
from risk.db import Supabase, SupabaseWriteError
from risk.hexes import Hex, nearest_point, read_hexes, slope_factor
from risk.openmeteo import WeatherFetchError, fetch, reading_rows
from risk.scoring import Report, build_row, pick_hazards
from risk.triggers import all_triggers
from risk.weather import DataGapError, Series

JOBS = Path(__file__).resolve().parent
POINTS_PATH = JOBS / "points.json"
DATA_DIR = REPO_ROOT / "data"


def load_points(path: Path = POINTS_PATH) -> list[dict[str, Any]]:
    return json.loads(path.read_text())["points"]


def score_all(
    points: list[dict[str, Any]],
    weather: dict[str, Series],
    cfg: dict[str, Any],
    now: datetime,
    run_at: datetime,
    history: set[tuple[int, str]],
    reports: list[Report],
    hexes: list[Hex] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (zone rows, hex rows). Pure: no network, no database."""
    base = now.replace(minute=0, second=0, microsecond=0)
    names = {p["id"]: p["name"] for p in points}
    zone_rows, hex_rows = [], []
    for horizon in cfg["horizons_hours"]:
        t = base + timedelta(hours=horizon)
        triggers = {p["id"]: all_triggers(weather[p["id"]], t, cfg) for p in points}
        common = dict(horizon_h=horizon, cfg=cfg, history=history, reports=reports, now=now, run_at=run_at)
        for zone_id in sorted({p["zone_id"] for p in points}):
            zone_points = {p["id"]: triggers[p["id"]] for p in points if p["zone_id"] == zone_id}
            picks = pick_hazards(zone_id, zone_points, names, cfg)
            zone_rows.append(build_row(zone_id=zone_id, picks=picks, **common))
        for h in hexes or []:
            p = nearest_point(h, points)
            picks = pick_hazards(h.zone_id, {p["id"]: triggers[p["id"]]}, names, cfg,
                                 slope_factor=slope_factor(h.slope_deg, cfg))
            hex_rows.append(build_row(zone_id=h.zone_id, picks=picks, h3_index=h.h3_index, **common))
    return zone_rows, hex_rows


def print_table(rows: list[dict[str, Any]]) -> None:
    print(f"{'zone':>4} {'h':>3} {'overall':>7} {'range':>11} {'level':<6} {'top':<11} {'conf':<6} reason")
    for r in rows:
        rng = f"{r['risk_low']:.2f}-{r['risk_high']:.2f}"
        print(f"{r['zone_id']:>4} {r['horizon_hours']:>3} {r['overall']:>7.3f} {rng:>11} {r['level']:<6} "
              f"{(r['top_hazard'] or '-'):<11} {r['confidence']:<6} {r['reason']}")


def read_history(db: Supabase) -> set[tuple[int, str]]:
    rows = db.select("incidents", {"select": "zone_id,hazard_type"})
    return {(r["zone_id"], r["hazard_type"]) for r in rows if r["zone_id"]}


def read_reports(db: Supabase, now: datetime, cfg: dict[str, Any]) -> list[Report]:
    since = (now - timedelta(hours=cfg["confidence"]["report_window_h"])).isoformat()
    rows = db.select("reports", {
        "select": "zone_id,hazard_type,source,status,created_at",
        "created_at": f"gte.{since}",
    })
    return [Report(r["zone_id"], r["hazard_type"], r["source"], r["status"],
                   datetime.fromisoformat(r["created_at"])) for r in rows]


def existing_hexes(db: Supabase, hexes: list[Hex]) -> list[Hex]:
    known = {r["h3_index"] for r in db.select("hexes", {"select": "h3_index"})}
    return [h for h in hexes if h.h3_index in known]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Fetch weather and score NH-44 closure risk.")
    ap.add_argument("--dry-run", action="store_true", help="fetch and score, print a table, write nothing")
    ap.add_argument("--data-dir", type=Path, default=DATA_DIR, help="folder with the hexagon CSVs (default: data/)")
    args = ap.parse_args(argv)

    cfg = load_config()
    points = load_points()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    print(f"risk job {cfg['model_version']} at {now.isoformat()} ({'DRY RUN' if args.dry_run else 'live'})")

    db = None
    if not args.dry_run:
        try:
            from dotenv import load_dotenv

            load_dotenv(JOBS / ".env", override=False)  # local runs only; CI uses env vars
        except ImportError:
            pass
        url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
        if not url or not key:
            print("ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be set (or use --dry-run).", file=sys.stderr)
            return 2
        db = Supabase(url, key)

    # 1. weather: if this fails, stop before writing anything
    try:
        weather = fetch(points)
    except WeatherFetchError as e:
        print(f"ERROR: {e}. Nothing was written.", file=sys.stderr)
        return 1
    first = min(h.time for s in weather.values() for h in s.hours)
    last = max(h.time for s in weather.values() for h in s.hours)
    print(f"Open-Meteo: {len(points)} points, {first:%Y-%m-%d %H:%M} to {last:%Y-%m-%d %H:%M} UTC")

    hexes = read_hexes(args.data_dir)
    try:
        if db:
            n = db.upsert("weather_readings", reading_rows(points, weather, now), on_conflict="point_id,valid_at")
            print(f"weather_readings: upserted {n} rows")
            history, reports = read_history(db), read_reports(db, now, cfg)
            if hexes:
                known = existing_hexes(db, hexes)
                if len(known) < len(hexes):
                    print(f"note: {len(hexes) - len(known)} hexes are not in the hexes table yet "
                          f"(run jobs/load_hexes.py); scoring the {len(known)} that are.")
                hexes = known
        else:
            history, reports = set(), []
            print("dry run: no database reads, so confidence uses exposure only")

        # 2. score
        try:
            zone_rows, hex_rows = score_all(points, weather, cfg, now, now, history, reports, hexes)
        except DataGapError as e:
            print(f"ERROR: weather data does not cover a horizon: {e}", file=sys.stderr)
            return 1
        print_table(zone_rows)
        if hexes:
            print(f"hexagons: {len(hex_rows)} rows ({len(hexes)} hexes x {len(cfg['horizons_hours'])} horizons)")

        # 3. write
        if db:
            n = db.insert("risk_scores", zone_rows + hex_rows)
            print(f"risk_scores: inserted {n} rows for run_at {now.isoformat()}")
        else:
            print(f"dry run: would insert {len(zone_rows) + len(hex_rows)} risk_scores rows; wrote nothing")
    except SupabaseWriteError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        if db:
            db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
