"""Replay the Aug 2025 NH-44 closure through our real rules (rules-v0.1).

Writes docs/ux/data/replay-2025-08-25.json, which the Round 2 prototype uses
for its "Historical replay" mode.

What it does:
  1. Loads the same 15 weather points and lib/risk/config.json the hourly job uses.
  2. Downloads hourly weather for 18 Aug to 20 Sep 2025 from the Open-Meteo
     ARCHIVE API (observed / reanalysis weather, not the forecast issued that
     day, so this is a best case for the model).
  3. Calls jobs/run_risk.score_all() unchanged for 24 Aug and 25 Aug 2025 06:00 UTC.

Run from the repo root:
  jobs/.venv/bin/python scripts/round2/replay_2025.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "jobs"))

from risk.config import load_config  # noqa: E402
from risk.openmeteo import HOURLY, parse  # noqa: E402
from run_risk import load_points, score_all  # noqa: E402

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
# (zone, hazard) pairs in data/incidents.csv on 15 Nov 2026.
HISTORY = {(3, "landslide"), (4, "landslide"), (5, "landslide"), (5, "snow_ice")}
NUM = ("landslide", "rockfall", "flash_flood", "snow_ice", "overall", "risk_low", "risk_high")


def clean(r: dict) -> dict:
    out = {k: r[k] for k in ("zone_id", "horizon_hours", "level", "top_hazard", "confidence", "reason")}
    out.update({k: round(float(r[k]), 3) for k in NUM})
    return out


def main() -> int:
    points, cfg = load_points(), load_config()
    resp = httpx.get(ARCHIVE, timeout=60, params={
        "latitude": ",".join(f"{p['lat']:.5f}" for p in points),
        "longitude": ",".join(f"{p['lng']:.5f}" for p in points),
        "hourly": ",".join(HOURLY),
        "start_date": "2025-08-18",
        "end_date": "2025-09-20",
        "timezone": "GMT",
    })
    resp.raise_for_status()
    raw = resp.json()
    weather = parse(points, raw if isinstance(raw, list) else [raw])

    def run(day: int) -> list[dict]:
        now = datetime(2025, 8, day, 6, tzinfo=timezone.utc)
        rows, _ = score_all(points, weather, cfg, now, now, HISTORY, [], [])
        return [clean(r) for r in rows]

    out = {
        "label": "Replay, 25 Aug 2025 06:00 UTC (11:30 IST)",
        "run_at": "2025-08-25T06:00:00Z",
        "source": "scripts/round2/replay_2025.py: rules-v0.1 run on Open-Meteo archive weather "
                  "(observed, not the forecast of that day)",
        "rows": run(25),
        "day_before": run(24),
    }
    path = ROOT / "docs/ux/data/replay-2025-08-25.json"
    path.write_text(json.dumps(out, indent=1))
    print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
