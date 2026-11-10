"""Check that the newest run wrote one zone row per zone per horizon, recently.

Used by the risk-job workflow right after run_risk.py, so a silent failure
(e.g. 0 rows written) still turns the run red.
  python jobs/check_run.py [--max-age-min 30]
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

from risk.config import load_config
from risk.db import Supabase, SupabaseWriteError


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-age-min", type=int, default=30)
    args = ap.parse_args(argv)
    cfg = load_config()
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be set.", file=sys.stderr)
        return 2
    db = Supabase(url, key)
    try:
        rows = db.select("latest_risk", {"select": "run_at,zone_id,horizon_hours", "h3_index": "is.null"})
    except SupabaseWriteError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()

    expected = 6 * len(cfg["horizons_hours"])
    if not rows:
        print("ERROR: latest_risk is empty.", file=sys.stderr)
        return 1
    run_at = datetime.fromisoformat(rows[0]["run_at"])
    age = datetime.now(timezone.utc) - run_at
    pairs = {(r["zone_id"], r["horizon_hours"]) for r in rows}
    print(f"latest run {run_at.isoformat()} ({age.total_seconds() / 60:.0f} min ago): "
          f"{len(rows)} zone rows, {len(pairs)} zone/horizon pairs")
    if len(rows) != expected or len(pairs) != expected:
        print(f"ERROR: expected {expected} zone rows.", file=sys.stderr)
        return 1
    if age > timedelta(minutes=args.max_age_min):
        print(f"ERROR: newest run is older than {args.max_age_min} min.", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
