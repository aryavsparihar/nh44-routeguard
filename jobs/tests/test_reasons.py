"""reason_code + reason_params: one case per code, and the shared list in lib/risk/reason_codes.json."""

import json

import pytest

from helpers import T
from risk.config import HAZARDS, load_config, load_reason_codes
from risk.scoring import HazardPick, build_row, exposure_band, pick_hazards, reason_code_and_params
from risk.triggers import Trigger

CFG = load_config()
CODES = load_reason_codes()

LANDSLIDE = {"rain_mm": 46.0, "hours": 72, "burst_mm": 10.0, "burst_hours": 24, "burst": False}
ROCKFALL = {"rain_mm": 46.0, "hours": 48, "freeze_thaw": False}
FLASH = {"burst_mm": 12.4, "burst_hours": 3}
SNOW = {"snow_cm": 4.26, "depth_m": 0.254, "black_ice": True, "temp_c": -2.0}


def pick(facts, point_id="z4_ramban"):
    return HazardPick(0.7, Trigger(0.7, facts), "Ramban", point_id)


# Zone 4's exposure is read from config.json, not hard-coded here.
def where(zone, hazard):
    from risk.config import exposure
    return {"place": "z4_ramban", "zone": zone, "exposure": exposure_band(exposure(CFG, zone, hazard))}


def test_none_when_nothing_triggers():
    assert reason_code_and_params(6, None, None, CFG) == ("none", {"zone": 6})


def test_landslide_rain():
    assert reason_code_and_params(4, "landslide", pick(LANDSLIDE), CFG) == (
        "landslide_rain", {"mm": 46, "hours": 72, **where(4, "landslide")})


def test_landslide_rain_with_burst():
    facts = {**LANDSLIDE, "burst": True, "burst_mm": 31.6}
    assert reason_code_and_params(4, "landslide", pick(facts), CFG) == (
        "landslide_rain_burst",
        {"mm": 46, "hours": 72, "burst_mm": 32, "burst_hours": 24, **where(4, "landslide")})


def test_rockfall_rain():
    assert reason_code_and_params(4, "rockfall", pick(ROCKFALL), CFG) == (
        "rockfall_rain", {"mm": 46, "hours": 48, **where(4, "rockfall")})


def test_rockfall_freeze_thaw():
    code, params = reason_code_and_params(4, "rockfall", pick({**ROCKFALL, "freeze_thaw": True}), CFG)
    assert code == "rockfall_freeze_thaw" and params["mm"] == 46


def test_flash_flood_burst():
    assert reason_code_and_params(4, "flash_flood", pick(FLASH), CFG) == (
        "flash_flood_burst", {"mm": 12, "hours": 3, **where(4, "flash_flood")})


def test_snow_ice():
    assert reason_code_and_params(4, "snow_ice", pick(SNOW), CFG) == (
        "snow_ice",
        {"snow_cm": 4.3, "depth_m": 0.25, "black_ice": "yes", **where(4, "snow_ice")})


def test_snow_ice_without_black_ice():
    _, params = reason_code_and_params(4, "snow_ice", pick({**SNOW, "black_ice": False}), CFG)
    assert params["black_ice"] == "no"


@pytest.mark.parametrize("mm, shown", [(0.0, 0), (0.04, 0.0), (3.46, 3.5), (9.94, 9.9), (10.4, 10), (79.6, 80)])
def test_numbers_round_like_the_english_reason(mm, shown):
    _, params = reason_code_and_params(4, "rockfall", pick({**ROCKFALL, "rain_mm": mm}), CFG)
    assert params["mm"] == shown


@pytest.mark.parametrize("e, band", [(1.0, "very_high"), (0.8, "very_high"), (0.79, "high"), (0.5, "high"),
                                     (0.49, "some"), (0.3, "some"), (0.29, "low"), (0.0, "low")])
def test_exposure_band_edges(e, band):
    assert exposure_band(e) == band


def all_cases():
    """Every (zone, hazard, facts) the job can meet, to produce every code."""
    variants = {
        "landslide": [LANDSLIDE, {**LANDSLIDE, "burst": True}],
        "rockfall": [ROCKFALL, {**ROCKFALL, "freeze_thaw": True}],
        "flash_flood": [FLASH],
        "snow_ice": [SNOW, {**SNOW, "black_ice": False}],
    }
    for zone in range(1, 7):
        yield reason_code_and_params(zone, None, None, CFG)
        for hazard, facts_list in variants.items():
            for facts in facts_list:
                yield reason_code_and_params(zone, hazard, pick(facts), CFG)


def test_every_code_and_param_set_is_in_the_shared_list():
    seen = set()
    for code, params in all_cases():
        assert code in CODES, code
        assert sorted(params) == sorted(CODES[code]), code
        assert len(code) <= 60  # risk_scores.reason_code check
        json.dumps(params)  # stored as a jsonb object
        seen.add(code)
    assert seen == set(CODES), "a listed code is never produced"


def test_place_is_the_point_id_from_pick_hazards():
    triggers = {h: Trigger(0.0, {}) for h in HAZARDS}
    triggers["flash_flood"] = Trigger(1.0, FLASH)
    picks = pick_hazards(4, {"z4_digdol": triggers}, {"z4_digdol": "Digdol"}, CFG)
    _, params = reason_code_and_params(4, "flash_flood", picks["flash_flood"], CFG)
    assert params["place"] == "z4_digdol"


def test_build_row_has_code_params_and_keeps_english_reason():
    triggers = {h: Trigger(0.0, {}) for h in HAZARDS}
    triggers["rockfall"] = Trigger(0.7, {**ROCKFALL, "freeze_thaw": True})
    picks = pick_hazards(4, {"z4_ramban": triggers}, {"z4_ramban": "Ramban"}, CFG)
    row = build_row(zone_id=4, horizon_h=12, picks=picks, cfg=CFG, history=set(), reports=[], now=T, run_at=T)
    assert row["reason_code"] == "rockfall_freeze_thaw"
    assert row["reason_params"]["place"] == "z4_ramban"
    assert row["reason"].startswith("Rockfall: 46 mm rain in 48 h, then below 0 °C near Ramban")


def test_build_row_with_nothing_triggering():
    triggers = {h: Trigger(0.0, {}) for h in HAZARDS}
    picks = pick_hazards(2, {"p": triggers}, {"p": "P"}, CFG)
    row = build_row(zone_id=2, horizon_h=0, picks=picks, cfg=CFG, history=set(), reports=[], now=T, run_at=T)
    assert (row["reason_code"], row["reason_params"]) == ("none", {"zone": 2})
