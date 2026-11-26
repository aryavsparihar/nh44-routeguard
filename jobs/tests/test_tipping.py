"""The app's "how much rain tips this cell" (src/shared/tipping.ts) works the
job's landslide rule backwards. This checks its table against the job itself:
at the listed mm the cell reaches the level, and 1 mm less it doesn't."""

import json

import pytest

from helpers import T, series, spread
from risk.config import REPO_ROOT, load_config
from risk.hexes import slope_factor
from risk.scoring import level, pick_hazards
from risk.triggers import all_triggers

CFG = load_config()
CASES = json.loads((REPO_ROOT / "lib" / "risk" / "tipping_cases.json").read_text())["cases"]


def cell_level(zone: int, slope: float | None, mm: float) -> str:
    # Spread evenly over 72 h: never more than 30 mm in 24 h below 90 mm (no downpour).
    s = series(rain=spread(mm, 0, 72))
    picks = pick_hazards(zone, {"p": all_triggers(s, T, CFG)}, {}, CFG, slope_factor=slope_factor(slope, CFG))
    return level(picks["landslide"].score, CFG)


@pytest.mark.parametrize("c", CASES, ids=lambda c: f"zone{c['zone']}-slope{c['slope']}")
def test_tipping_table_matches_the_job(c):
    if c["medium_mm"] is None:
        assert cell_level(c["zone"], c["slope"], 89) == "low"
    else:
        assert cell_level(c["zone"], c["slope"], c["medium_mm"]) in ("medium", "high")
        assert cell_level(c["zone"], c["slope"], c["medium_mm"] - 1) == "low"
    if c["high_mm"] is None:
        assert cell_level(c["zone"], c["slope"], 89) != "high"
    else:
        assert cell_level(c["zone"], c["slope"], c["high_mm"]) == "high"
        assert cell_level(c["zone"], c["slope"], c["high_mm"] - 1) != "high"
