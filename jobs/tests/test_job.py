"""The whole job without network: zone rows, hexagon path, dry run, failures."""

from datetime import timedelta
from pathlib import Path

import httpx
import pytest

import run_risk
from helpers import T, series, spread
from risk.config import load_config
from risk.db import Supabase, SupabaseWriteError
from risk.hexes import read_hexes, slope_factor
from risk.openmeteo import WeatherFetchError

CFG = load_config()
FIXTURES = Path(__file__).parent / "fixtures"
POINTS = run_risk.load_points()


def fake_weather(rain_at=None):
    """Every point gets 120 h of data around T; optional heavy rain at one point."""
    out = {}
    for p in POINTS:
        rain = spread(60, 0, 6) if p["id"] == rain_at else None
        out[p["id"]] = series(hours=120, end=T + timedelta(hours=48), rain=rain)
    return out


def test_points_file_has_every_zone_and_valid_coordinates():
    assert {p["zone_id"] for p in POINTS} == {1, 2, 3, 4, 5, 6}
    for p in POINTS:
        assert 32.5 < p["lat"] < 34.3 and 74.6 < p["lng"] < 75.5, p["id"]
    assert len({p["id"] for p in POINTS}) == len(POINTS)


def test_24_zone_rows_per_run():
    zone_rows, hex_rows = run_risk.score_all(POINTS, fake_weather(), CFG, T, T, set(), [])
    assert len(zone_rows) == 24 and hex_rows == []
    assert {(r["zone_id"], r["horizon_hours"]) for r in zone_rows} == {
        (z, h) for z in range(1, 7) for h in (0, 12, 24, 48)}
    assert all(r["h3_index"] is None and r["model_version"] == "rules-v0.1" for r in zone_rows)
    assert all(len(r["reason"]) <= 140 for r in zone_rows)


def test_rain_at_one_point_raises_only_its_zone():
    ramban = next(p for p in POINTS if p["id"] == "z4_ramban")
    # rain falls in the 6 h before T+48h, so only the 48 h horizon sees it
    zone_rows, _ = run_risk.score_all(POINTS, fake_weather("z4_ramban"), CFG, T, T, set(), [])
    by = {(r["zone_id"], r["horizon_hours"]): r for r in zone_rows}
    assert by[(4, 48)]["overall"] > 0.5 and "Ramban" in by[(4, 48)]["reason"]
    assert by[(4, 0)]["overall"] == 0
    assert by[(3, 48)]["overall"] == 0
    assert ramban["zone_id"] == 4


# --- hexagons ---------------------------------------------------------------
def test_hex_files_missing_skips_quietly(tmp_path):
    assert read_hexes(tmp_path) is None
    assert read_hexes(FIXTURES / "hexdata_missing") is None  # only one of the two files


def test_hex_path_with_tiny_fake_csv():
    hexes = read_hexes(FIXTURES / "hexdata")
    assert [h.h3_index for h in hexes] == ["883d308abdfffff", "883d309521fffff", "883d30cb2bfffff"]
    assert [h.slope_deg for h in hexes] == [17.5, 50.0, None]
    zone_rows, hex_rows = run_risk.score_all(POINTS, fake_weather("z4_ramban"), CFG, T, T, set(), [], hexes)
    assert len(zone_rows) == 24 and len(hex_rows) == 12
    ramban_48 = next(r for r in hex_rows if r["h3_index"] == "883d308abdfffff" and r["horizon_hours"] == 48)
    zone4_48 = next(r for r in zone_rows if r["zone_id"] == 4 and r["horizon_hours"] == 48)
    # 60 mm in 72 h with a 24 h burst: trigger (60-10)/70 + 0.2 = 0.914; zone 4 exposure 0.8
    assert zone4_48["landslide"] == pytest.approx(0.731)
    # slope 17.5° -> factor 0.5 on landslide and rockfall: 0.914 * 0.8 * 0.5
    assert ramban_48["landslide"] == pytest.approx(0.366)
    assert ramban_48["flash_flood"] == zone4_48["flash_flood"]


def test_slope_factor():
    assert slope_factor(0, CFG) == 0
    assert slope_factor(17.5, CFG) == 0.5
    assert slope_factor(35, CFG) == 1
    assert slope_factor(60, CFG) == 1
    assert slope_factor(None, CFG) == 1


# --- dry run and failures -----------------------------------------------------
def test_dry_run_needs_no_key_and_writes_nothing(monkeypatch, capsys):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setattr(run_risk, "fetch", lambda pts: fake_weather())
    monkeypatch.setattr(run_risk, "datetime", _FrozenDatetime)

    def no_db(*a, **k):
        raise AssertionError("dry run must not touch the database")

    monkeypatch.setattr(run_risk, "Supabase", no_db)
    assert run_risk.main(["--dry-run", "--data-dir", str(FIXTURES / "nothing")]) == 0
    out = capsys.readouterr().out
    assert "wrote nothing" in out and "zone" in out


def test_live_run_without_keys_exits_2(monkeypatch, tmp_path):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setattr(run_risk, "JOBS", tmp_path)  # no jobs/.env
    assert run_risk.main([]) == 2


def test_open_meteo_failure_writes_nothing(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "not-a-real-key-for-tests")
    writes = []

    class FakeDb:
        def __init__(self, *a):
            pass

        def upsert(self, *a, **k):
            writes.append(a)

        insert = upsert

        def close(self):
            pass

    def boom(pts):
        raise WeatherFetchError("down")

    monkeypatch.setattr(run_risk, "Supabase", FakeDb)
    monkeypatch.setattr(run_risk, "fetch", boom)
    assert run_risk.main([]) == 1
    assert writes == []


def test_supabase_rejecting_a_write_fails_loudly():
    db = Supabase("https://abcdefghijklmnopqrst.supabase.co", "not-a-real-key-for-tests",
                  client=httpx.Client(transport=httpx.MockTransport(
                      lambda r: httpx.Response(401, json={"message": "Invalid API key"}))))
    with pytest.raises(SupabaseWriteError) as e:
        db.insert("risk_scores", [{"zone_id": 1}])
    assert "401" in str(e.value)
    assert "not-a-real-key-for-tests" not in str(e.value)  # never echo the key


def test_new_style_key_is_sent_as_apikey_only():
    seen = {}

    def handler(req):
        seen.update(req.headers)
        return httpx.Response(201)

    db = Supabase("https://abcdefghijklmnopqrst.supabase.co", "not-a-real-key-x",
                  client=httpx.Client(transport=httpx.MockTransport(handler)))
    db.insert("risk_scores", [{}])
    assert seen["apikey"] == "not-a-real-key-x" and "authorization" not in seen


def test_dashboard_url_is_rejected():
    with pytest.raises(ValueError):
        Supabase("https://supabase.com/dashboard/project/abc", "not-a-real-key-x")


class _FrozenDatetime(run_risk.datetime):
    @classmethod
    def now(cls, tz=None):
        return T


def test_load_hexes_dry_run(capsys):
    import load_hexes

    assert load_hexes.main(["--dry-run", "--data-dir", str(FIXTURES / "hexdata")]) == 0
    assert "3 hexes" in capsys.readouterr().out
    assert load_hexes.main(["--dry-run", "--data-dir", str(FIXTURES / "hexdata_missing")]) == 1


def test_hex_rows_for_db_have_centre_and_nearest_point():
    from risk.hexes import hex_rows_for_db

    rows = hex_rows_for_db(read_hexes(FIXTURES / "hexdata"), POINTS)
    by = {r["h3_index"]: r for r in rows}
    assert by["883d308abdfffff"]["weather_point_id"] == "z4_ramban"
    assert by["883d309521fffff"]["weather_point_id"] == "z5_banihal"
    assert by["883d308abdfffff"]["centroid"].startswith("SRID=4326;POINT(75.2")
