"""Load data/corridor_hexes.csv + data/hex_slope.csv into the hexes table.

Run it once Navaya's two CSVs are in /data (and again whenever they change):
  python jobs/load_hexes.py --dry-run   # check the files, write nothing
  python jobs/load_hexes.py             # upsert into hexes (needs SUPABASE_URL + SUPABASE_SECRET_KEY)

Each hex gets its centre point (from the H3 index) and its nearest weather point
from jobs/points.json. After this, run_risk.py also scores every hexagon.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from risk.db import Supabase, SupabaseWriteError
from risk.hexes import CORRIDOR, SLOPE, hex_rows_for_db, read_hexes
from run_risk import DATA_DIR, JOBS, load_points


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Load corridor hexagons into Supabase.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--data-dir", type=Path, default=DATA_DIR)
    args = ap.parse_args(argv)

    hexes = read_hexes(args.data_dir)
    if hexes is None:
        print(f"Need both {CORRIDOR} and {SLOPE} in {args.data_dir}. Nothing to load.")
        return 1
    zones = {h.zone_id for h in hexes}
    if not zones <= set(range(1, 7)):
        print(f"ERROR: zone_id must be 1-6, found {sorted(zones - set(range(1, 7)))}", file=sys.stderr)
        return 1
    rows = hex_rows_for_db(hexes, load_points())
    no_slope = sum(1 for r in rows if r["slope_deg"] is None)
    print(f"{len(rows)} hexes in zones {sorted(zones)}; {no_slope} without a slope value")

    if args.dry_run:
        print("dry run: wrote nothing")
        return 0
    try:
        from dotenv import load_dotenv

        load_dotenv(JOBS / ".env", override=False)
    except ImportError:
        pass
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be set.", file=sys.stderr)
        return 2
    db = Supabase(url, key)
    try:
        n = db.upsert("hexes", rows, on_conflict="h3_index")
    except SupabaseWriteError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    print(f"hexes: upserted {n} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
