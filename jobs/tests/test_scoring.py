"""Zone max, overall/top hazard, range, level, confidence and reason."""

from datetime import timedelta

import pytest

from helpers import T
from risk.config import HAZARDS, load_config
from risk.scoring import (
    Report,
    build_row,
    confidence,
    level,
    overall_and_top,
    pick_hazards,
    reason,
    score_range,
)
from risk.triggers import Trigger

CFG = load_config()


def trig(**scores):
    """Fake triggers: every hazard 0 unless given."""
    facts = {
        "landslide": {"rain_mm": 46.0, "hours": 72, "burst_mm": 10.0, "burst_hours": 24, "burst": False},
        "rockfall": {"rain_mm": 46.0, "hours": 48, "freeze_thaw": True},
        "flash_flood": {"burst_mm": 12.0, "burst_hours": 3},
        "snow_ice": {"snow_cm": 0.0, "depth_m": 0.0, "black_ice": False, "temp_c": 3.0},
    }
    return {h: Trigger(scores.get(h, 0.0), facts[h]) for h in HAZARDS}


# --- zone max across points ------------------------------------------------
def test_zone_takes_highest_point_per_hazard():
    picks = pick_hazards(
        4,
        {"a": trig(rockfall=0.3, landslide=0.9), "b": trig(rockfall=0.8, landslide=0.1)},
        {"a": "Ramban", "b": "Digdol"},
        CFG,
    )
    # zone 4 exposure: rockfall 1.0, landslide 0.8
    assert picks["rockfall"].score == pytest.approx(0.8)
    assert picks["rockfall"].point_name == "Digdol"
    assert picks["landslide"].score == pytest.approx(0.72)
    assert picks["landslide"].point_name == "Ramban"


def test_exposure_scales_the_trigger():
    picks = pick_hazards(1, {"a": trig(landslide=1.0)}, {"a": "Nagrota"}, CFG)
    assert picks["landslide"].score == pytest.approx(0.1)  # zone 1 exposure 0.1


def test_slope_factor_only_hits_landslide_and_rockfall():
    picks = pick_hazards(3, {"a": trig(landslide=1, rockfall=1, flash_flood=1)}, {}, CFG, slope_factor=0.5)
    assert picks["landslide"].score == pytest.approx(0.45)
    assert picks["rockfall"].score == pytest.approx(0.30)
    assert picks["flash_flood"].score == pytest.approx(0.80)


# --- overall and top hazard ------------------------------------------------
def test_overall_is_max_and_names_hazard():
    assert overall_and_top({"landslide": 0.2, "rockfall": 0.7, "flash_flood": 0.1, "snow_ice": 0}) == (0.7, "rockfall")


def test_tie_goes_to_first_hazard_in_list():
    assert overall_and_top({"landslide": 0.5, "rockfall": 0.5, "flash_flood": 0, "snow_ice": 0})[1] == "landslide"


def test_all_zero_has_no_top_hazard():
    assert overall_and_top({h: 0.0 for h in HAZARDS}) == (0.0, None)


# --- range ----------------------------------------------------------------
@pytest.mark.parametrize("h,w", [(0, 0.05), (12, 0.10), (24, 0.15), (48, 0.20)])
def test_range_width_per_horizon(h, w):
    low, high = score_range(0.5, h, CFG)
    assert low == pytest.approx(0.5 - w) and high == pytest.approx(0.5 + w)


def test_range_is_clamped_to_0_1():
    assert score_range(0.02, 48, CFG) == (0.0, pytest.approx(0.22))
    assert score_range(0.97, 24, CFG) == (pytest.approx(0.82), 1.0)


# --- level ----------------------------------------------------------------
@pytest.mark.parametrize("x,expected", [
    (0.0, "low"), (0.299, "low"), (0.30, "medium"), (0.5, "medium"),
    (0.65, "medium"), (0.651, "high"), (1.0, "high"),
])
def test_level_edges(x, expected):
    assert level(x, CFG) == expected


# --- confidence -------------------------------------------------------------
def rep(zone=4, hazard="rockfall", source="driver", status="confirmed", hours_ago=1):
    return Report(zone, hazard, source, status, T - timedelta(hours=hours_ago))


def test_confirmed_report_gives_high():
    assert confidence(1, "rockfall", 0, CFG, set(), [rep(zone=1)], T) == "high"


def test_police_update_counts_even_if_unconfirmed():
    assert confidence(1, "rockfall", 0, CFG, set(), [rep(zone=1, source="police", status="unconfirmed")], T) == "high"


def test_unconfirmed_driver_report_does_not_count():
    assert confidence(1, "rockfall", 0, CFG, set(), [rep(zone=1, status="unconfirmed")], T) == "low"


def test_report_must_match_zone_hazard_and_be_recent():
    assert confidence(1, "rockfall", 0, CFG, set(), [rep(zone=2)], T) == "low"
    assert confidence(1, "rockfall", 0, CFG, set(), [rep(zone=1, hazard="landslide")], T) == "low"
    assert confidence(1, "rockfall", 0, CFG, set(), [rep(zone=1, hours_ago=7)], T) == "low"
    assert confidence(1, "rockfall", 0, CFG, set(), [rep(zone=1, status="expired")], T) == "low"


def test_report_beats_48h_rule():
    assert confidence(1, "rockfall", 48, CFG, set(), [rep(zone=1)], T) == "high"


def test_history_from_incidents_gives_medium():
    assert confidence(1, "landslide", 12, CFG, {(1, "landslide")}, [], T) == "medium"


def test_exposure_fallback_gives_medium():
    assert confidence(4, "rockfall", 24, CFG, set(), [], T) == "medium"  # exposure 1.0
    assert confidence(2, "rockfall", 24, CFG, set(), [], T) == "low"  # exposure 0.3


def test_48h_is_low_without_report():
    assert confidence(4, "rockfall", 48, CFG, {(4, "rockfall")}, [], T) == "low"


def test_no_top_hazard_is_low():
    assert confidence(4, None, 0, CFG, set(), [], T) == "low"


# --- reason ---------------------------------------------------------------
def test_reason_matches_example_style_and_length():
    picks = pick_hazards(4, {"a": trig(rockfall=0.7)}, {"a": "Ramban"}, CFG)
    text = reason(4, "rockfall", picks["rockfall"], CFG)
    assert text == "Rockfall: 46 mm rain in 48 h, then below 0 °C near Ramban; zone 4 is very exposed to rockfall"
    assert len(text) <= 140


def test_reason_never_over_140_chars():
    picks = pick_hazards(5, {"a": trig(snow_ice=1)}, {"a": "X" * 200}, CFG)
    picks["snow_ice"].trigger.facts.update(snow_cm=15, depth_m=0.25, black_ice=True)
    assert len(reason(5, "snow_ice", picks["snow_ice"], CFG)) <= 140


def test_reason_when_nothing_triggers():
    assert reason(6, None, None, CFG).startswith("Zone 6: no")


# --- whole row ------------------------------------------------------------
def test_build_row_shape():
    picks = pick_hazards(4, {"a": trig(rockfall=0.7, landslide=0.2)}, {"a": "Ramban"}, CFG)
    row = build_row(zone_id=4, horizon_h=12, picks=picks, cfg=CFG, history=set(), reports=[], now=T, run_at=T)
    assert row["overall"] == 0.7 and row["top_hazard"] == "rockfall"
    assert (row["risk_low"], row["risk_high"]) == (0.6, 0.8)
    assert row["level"] == "high" and row["confidence"] == "medium"
    assert row["h3_index"] is None and row["model_version"] == "rules-v0.1"
    assert set(HAZARDS) <= row.keys()
