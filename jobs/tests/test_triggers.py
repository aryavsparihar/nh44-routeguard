"""Each trigger at its edges: 0, middle, cap. Thresholds are our own starting values."""

import pytest

from helpers import T, series, spread
from risk.config import load_config
from risk.triggers import flash_flood, landslide, rockfall, scale, snow_ice
from risk.weather import DataGapError

CFG = load_config()
TR = CFG["triggers"]


# --- scale -----------------------------------------------------------------
def test_scale_edges():
    assert scale(10, 10, 80) == 0
    assert scale(45, 10, 80) == pytest.approx(0.5)
    assert scale(80, 10, 80) == 1
    assert scale(500, 10, 80) == 1
    assert scale(-5, 10, 80) == 0


# --- landslide: 72 h rain, 0 at 10 mm -> 1 at 80 mm, +0.2 if > 30 mm in 24 h -----
def test_landslide_zero_at_10mm():
    t = landslide(series(rain=spread(10, 30, 10)), T, TR["landslide"])
    assert t.score == 0


def test_landslide_middle_without_burst():
    # 45 mm spread over 60 h -> never more than 30 mm in any 24 h
    t = landslide(series(rain=spread(45, 0, 60)), T, TR["landslide"])
    assert t.score == pytest.approx(0.5)
    assert not t.facts["burst"]


def test_landslide_burst_bonus():
    # 45 mm, of which 40 mm in the last 24 h -> 0.5 + 0.2
    t = landslide(series(rain={**spread(5, 40, 5), **spread(40, 0, 10)}), T, TR["landslide"])
    assert t.score == pytest.approx(0.7)
    assert t.facts["burst"]


def test_landslide_exactly_30mm_in_24h_is_not_a_burst():
    t = landslide(series(rain=spread(30, 0, 10)), T, TR["landslide"])
    assert not t.facts["burst"]


def test_landslide_caps_at_1():
    t = landslide(series(rain=spread(100, 0, 10)), T, TR["landslide"])
    assert t.score == 1


def test_rain_older_than_72h_is_ignored():
    t = landslide(series(rain=spread(100, 72, 10)), T, TR["landslide"])
    assert t.score == 0


# --- rockfall: max(48 h rain 10 -> 50 mm, freeze-thaw 0.7) ------------------
def test_rockfall_zero_and_middle_and_cap():
    assert rockfall(series(rain=spread(10, 0, 5)), T, TR["rockfall"]).score == 0
    assert rockfall(series(rain=spread(30, 0, 5)), T, TR["rockfall"]).score == pytest.approx(0.5)
    assert rockfall(series(rain=spread(80, 0, 5)), T, TR["rockfall"]).score == 1


def test_rockfall_freeze_thaw_after_rain():
    # 12 mm 10-6 h before T, then -2 °C at the last hour
    t = rockfall(series(rain=spread(12, 6, 4), temp={0: -2.0}), T, TR["rockfall"])
    assert t.facts["freeze_thaw"]
    assert t.score == pytest.approx(0.7)  # rain part is only 0.05


def test_rockfall_no_freeze_thaw_if_rain_under_10mm():
    t = rockfall(series(rain=spread(8, 6, 4), temp={0: -2.0}), T, TR["rockfall"])
    assert not t.facts["freeze_thaw"]


def test_rockfall_no_freeze_thaw_if_freeze_more_than_24h_after_rain():
    # rain 40-36 h before T, freezing only at T -> more than 24 h later
    t = rockfall(series(rain=spread(12, 36, 4), temp={0: -2.0}), T, TR["rockfall"])
    assert not t.facts["freeze_thaw"]


def test_rockfall_takes_the_higher_part():
    # 50 mm in 48 h (=1.0) beats freeze-thaw 0.7
    t = rockfall(series(rain=spread(50, 2, 5), temp={0: -2.0}), T, TR["rockfall"])
    assert t.score == 1


# --- flash flood: heaviest 3 h, 0 at 5 mm -> 1 at 25 mm ----------------------
def test_flash_flood_edges():
    assert flash_flood(series(rain=spread(5, 0, 3)), T, TR["flash_flood"]).score == 0
    assert flash_flood(series(rain=spread(15, 0, 3)), T, TR["flash_flood"]).score == pytest.approx(0.5)
    assert flash_flood(series(rain=spread(40, 0, 3)), T, TR["flash_flood"]).score == 1


def test_flash_flood_uses_heaviest_3h_not_total():
    # 24 mm over 24 h = 1 mm/h -> heaviest 3 h is 3 mm -> 0
    assert flash_flood(series(rain=spread(24, 0, 24)), T, TR["flash_flood"]).score == 0


def test_flash_flood_finds_burst_earlier_in_window():
    t = flash_flood(series(rain=spread(15, 10, 3)), T, TR["flash_flood"])
    assert t.facts["burst_mm"] == pytest.approx(15)


# --- snow/ice: max(snowfall 24 h -> 20 cm, depth -> 0.3 m, black ice 0.6) ----
def test_snow_ice_zero_when_warm_and_dry():
    assert snow_ice(series(), T, TR["snow_ice"]).score == 0


def test_snowfall_middle_and_cap():
    assert snow_ice(series(snow=spread(10, 0, 5)), T, TR["snow_ice"]).score == pytest.approx(0.5)
    assert snow_ice(series(snow=spread(30, 0, 5)), T, TR["snow_ice"]).score == 1


def test_snow_depth_middle_and_cap():
    assert snow_ice(series(depth=0.15), T, TR["snow_ice"]).score == pytest.approx(0.5)
    assert snow_ice(series(depth=0.5), T, TR["snow_ice"]).score == 1


def test_black_ice_needs_freezing_and_wet():
    assert snow_ice(series(temp=-1.0), T, TR["snow_ice"]).score == 0  # frozen but dry
    assert snow_ice(series(rain={3: 0.2}), T, TR["snow_ice"]).score == 0  # wet but above 0
    t = snow_ice(series(rain={3: 0.2}, temp=-1.0), T, TR["snow_ice"])
    assert t.facts["black_ice"] and t.score == pytest.approx(0.6)


def test_black_ice_with_snow_on_ground():
    t = snow_ice(series(depth=0.03, temp=-3.0), T, TR["snow_ice"])
    assert t.score == pytest.approx(0.6)  # depth part is 0.1, black ice wins


# --- data gaps ---------------------------------------------------------------
def test_missing_forecast_hour_raises():
    s = series(hours=24)
    from datetime import timedelta
    with pytest.raises(DataGapError):
        landslide(s, T + timedelta(hours=12), TR["landslide"])
