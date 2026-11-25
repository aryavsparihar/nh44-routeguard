"""Storm replays: scoring a past incident on fake weather, the API shapes,
and that only verified incidents are used. No network."""

import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

import replay
from helpers import series, spread
from risk.config import HAZARDS, load_config
from risk.hexes import read_hexes
from run_risk import load_points

CFG = load_config()
POINTS = load_points()
HEXES = read_hexes(Path(__file__).parent / "fixtures" / "hexdata")
T = datetime(2025, 4, 20, 6, tzinfo=timezone.utc)
INCIDENT = {"id": "inc-2025-04-20-z4-flash_flood", "event_start_date": "2025-04-20", "zone_id": "4",
            "place": "Seri to Maroog, Ramban", "hazard_type": "flash_flood",
            "source_publisher": "Example", "source_url": "https://example.org/a"}


class FakeFetcher:
    """120 mm in the 24 h before T at every point, dry after; covers T+48 h."""

    def __init__(self):
        self.asked = []

    def archive(self, point, start, end):
        self.asked.append((point["id"], start, end))
        return series(hours=96 + 72, end=T + timedelta(hours=72), rain=spread(120, 72, 24))


def test_scores_every_zone_and_cell_in_the_api_shapes():
    fetcher = FakeFetcher()
    ev = replay.build_event(INCIDENT, POINTS, HEXES, fetcher, CFG)
    assert {p for p, _, _ in fetcher.asked} == {p["id"] for p in POINTS}
    assert ev["scored_at"] == "2025-04-20T06:00:00Z"
    assert len(ev["rows"]) == 6 * len(CFG["horizons_hours"])
    assert len(ev["hexes"]) == len(HEXES) * len(CFG["horizons_hours"])
    row = ev["rows"][0]
    assert set(row) == {"zone_id", "horizon_hours", "overall", "risk_low", "risk_high", "level", "top_hazard",
                        "confidence", "hazards", "reason", "reason_code", "reason_params"}
    assert set(row["hazards"]) == set(HAZARDS)
    cell = ev["hexes"][0]
    assert {"h3_index", "horizon_hours", "slope_deg", *HAZARDS} <= set(cell)
    # 120 mm the day before: the storm shows at +0 h somewhere
    assert any(r["level"] == "high" for r in ev["rows"] if r["horizon_hours"] == 0)


def test_only_verified_real_incidents(tmp_path):
    path = tmp_path / "incidents.csv"
    cols = ["id", "event_start_date", "zone_id", "verified_by", "is_demo"]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerow({"id": "a", "event_start_date": "2025-01-01", "zone_id": "4", "verified_by": "X", "is_demo": "false"})
        w.writerow({"id": "b", "event_start_date": "2025-01-01", "zone_id": "4", "verified_by": "", "is_demo": "false"})
        w.writerow({"id": "c", "event_start_date": "2025-01-01", "zone_id": "4", "verified_by": "X", "is_demo": "true"})
    assert [r["id"] for r in replay.read_incidents(path, ("a",))] == ["a"]
    for bad in ("b", "c", "missing"):
        with pytest.raises(SystemExit):
            replay.read_incidents(path, (bad,))


def test_the_committed_file_matches_the_event_list():
    data = json.loads(replay.OUT_JSON.read_text())
    assert data["format"] == replay.FORMAT
    assert tuple(e["id"] for e in data["events"]) == replay.EVENTS
    replay.read_incidents(replay.INCIDENTS_CSV, replay.EVENTS)  # all still verified
