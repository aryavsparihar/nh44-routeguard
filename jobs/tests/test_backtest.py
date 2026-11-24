"""Backtest: archived weather parsing, the forecast splice, hits, false alarms,
incident loading and the report. Fake weather only, no network."""

import json
from datetime import date, datetime, timedelta, timezone

import pytest

import backtest
from backtest import Incident, check_incident, complete, false_alarms, forecast_view, load_incidents, render_md
from helpers import series, spread
from risk.config import load_config
from risk.history import Fetcher, parse_previous_runs
from risk.openmeteo import WeatherFetchError
from risk.weather import Hour, Series

CFG = load_config()
POINTS = json.loads((backtest.JOBS / "points.json").read_text())["points"]
DAY = date(2025, 8, 26)
T = datetime(2025, 8, 26, 6, tzinfo=timezone.utc)


# --- archived weather --------------------------------------------------------------
def raw_previous_runs(n=3, depth=0.1):
    times = [f"2025-08-26T0{i}:00" for i in range(n)]
    hourly = {"time": times, "snow_depth": [depth] * n}
    for d, rain in ((0, 1.0), (1, 2.0), (2, 3.0)):
        sfx = "" if d == 0 else f"_previous_day{d}"
        hourly[f"precipitation{sfx}"] = [rain] * n
        hourly[f"snowfall{sfx}"] = [0.0] * n
        hourly[f"temperature_2m{sfx}"] = [5.0] * n
    return {"hourly": hourly}


def test_previous_runs_give_one_series_per_day_with_newest_snow_depth():
    out = parse_previous_runs(raw_previous_runs())
    assert [out[d].hours[0].precip_mm for d in (0, 1, 2)] == [1.0, 2.0, 3.0]
    assert all(out[d].hours[0].snow_depth_m == 0.1 for d in (0, 1, 2))
    assert out[0].hours[0].time == datetime(2025, 8, 26, 0, tzinfo=timezone.utc)


def test_a_short_column_is_an_error():
    raw = raw_previous_runs()
    raw["hourly"]["precipitation_previous_day2"] = [1.0]
    with pytest.raises(WeatherFetchError):
        parse_previous_runs(raw)


def test_fetcher_caches_and_splits_long_ranges(tmp_path):
    calls = []

    def get(url, params):
        calls.append(params["start_date"])
        return raw_previous_runs()

    f = Fetcher(cache_dir=tmp_path, get=get)
    point = POINTS[0]
    f.previous_runs(point, date(2024, 2, 1), date(2024, 8, 18))  # 200 days -> 3 chunks
    assert len(calls) == 3
    f.previous_runs(point, date(2024, 2, 1), date(2024, 8, 18))
    assert len(calls) == 3 and f.calls == 3  # second time from the cache


# --- the forecast as known at issue time ---------------------------------------------
def flat(rain, depth=0.0, end=T + timedelta(hours=24), hours=200):
    return Series([Hour(end - timedelta(hours=k), rain, 0.0, depth, 5.0) for k in range(hours)])


def test_forecast_view_splices_at_issue_time_and_holds_snow_depth():
    issue = T - timedelta(hours=24)
    view = forecast_view(flat(1.0, depth=0.2), flat(9.0, depth=0.8), issue, T)
    assert view.at(issue).precip_mm == 1.0  # already happened: newest run
    assert view.at(issue + timedelta(hours=1)).precip_mm == 9.0  # ahead: older forecast
    assert view.at(T).snow_depth_m == 0.2  # depth known at issue time
    assert complete(view, T)


def test_missing_values_make_a_check_incomplete():
    s = flat(1.0)
    gap = Series([h if h.time != T - timedelta(hours=5) else Hour(h.time, None, 0.0, 0.0, 5.0) for h in s.hours])
    assert complete(s, T) and not complete(gap, T)


# --- one incident ---------------------------------------------------------------------
class FakeFetcher:
    """The same series for every point: heavy rain or none."""

    def __init__(self, rain_mm=0.0, forecast_rain_mm=None):
        end = T + timedelta(days=2)
        wet = spread(rain_mm, 48 + 6, 24)  # falls 30-54 h before T: inside every window, before every issue
        self.actual = series(hours=400, end=end, rain=wet)
        f = rain_mm if forecast_rain_mm is None else forecast_rain_mm
        self.forecast = series(hours=400, end=end, rain=spread(f, 48 + 6, 24))
        self.calls = 0

    def archive(self, point, start, end):
        return self.actual

    def previous_runs(self, point, start, end):
        return {0: self.actual, 1: self.forecast, 2: self.forecast}


def incident(day=DAY, zone=4, hazard="landslide"):
    return Incident(id="1", day=day, zone_id=zone, hazard=hazard, place="Test")


def test_heavy_rain_is_a_hit_at_every_lead():
    r = check_incident(incident(), POINTS, FakeFetcher(rain_mm=120), CFG)
    assert all(r["forecast"][k]["hit"] for k in ("48", "24", "12"))
    assert r["forecast"]["48"]["right_hazard"] is True
    assert r["lead_time_h"] == 48
    assert r["on_the_day"]["hit"] is True


def test_dry_weather_is_a_miss():
    r = check_incident(incident(), POINTS, FakeFetcher(rain_mm=0), CFG)
    assert not any(r["forecast"][k]["hit"] for k in ("48", "24", "12"))
    assert r["lead_time_h"] is None


def test_wrong_hazard_is_flagged_but_not_right_hazard():
    r = check_incident(incident(hazard="snow_ice"), POINTS, FakeFetcher(rain_mm=120), CFG)
    assert r["on_the_day"]["hit"] is True and r["on_the_day"]["right_hazard"] is False


def test_events_before_archived_forecasts_only_get_the_on_the_day_check():
    old = incident(day=date(2019, 5, 9))
    f = FakeFetcher(rain_mm=120)
    f.actual = series(hours=400, end=old.t + timedelta(days=2), rain=spread(120, 48 + 6, 24))
    r = check_incident(old, POINTS, f, CFG)
    assert r["forecast"] == {"48": None, "24": None, "12": None}
    assert r["on_the_day"] is not None


# --- false alarms -----------------------------------------------------------------------
class WholePeriodFetcher:
    def __init__(self, rainy_day=None):
        end = datetime(2025, 8, 31, tzinfo=timezone.utc)
        rain = {}
        if rainy_day:
            back = int((end - datetime(rainy_day.year, rainy_day.month, rainy_day.day, 3, tzinfo=timezone.utc))
                       .total_seconds() // 3600)
            rain = spread(150, back, 6)
        self.s = series(hours=24 * 30, end=end, rain=rain)

    def previous_runs(self, point, start, end):
        return {0: self.s, 1: self.s, 2: self.s}


def test_dry_period_has_no_false_alarms():
    fa = false_alarms(POINTS, [], WholePeriodFetcher(), CFG, date(2025, 8, 20), date(2025, 8, 25))
    assert fa["alarm_days"] == 0
    assert fa["per_zone"]["4"]["days_scored"] == 6


def test_alarm_next_to_an_incident_is_not_a_false_alarm():
    rainy = date(2025, 8, 23)
    without = false_alarms(POINTS, [], WholePeriodFetcher(rainy), CFG, date(2025, 8, 20), date(2025, 8, 25))
    near = [Incident("x", rainy + timedelta(days=1), z, "landslide", "") for z in range(1, 7)]
    with_inc = false_alarms(POINTS, near, WholePeriodFetcher(rainy), CFG, date(2025, 8, 20), date(2025, 8, 25))
    assert without["alarm_days"] > 0
    assert with_inc["alarm_days"] < without["alarm_days"]


# --- incidents file ------------------------------------------------------------------------
NEW_HEADER = "id,event_start_date,zone_id,place,hazard_type,added_by,verified_by,is_demo\n"


def test_old_csv_without_verification_gives_zero_and_a_reason(tmp_path):
    p = tmp_path / "incidents.csv"
    p.write_text("date,zone_id,place,hazard_type\n2019-05-09,4,Digdol,landslide\n")
    rows, reason = load_incidents(p)
    assert rows == [] and "event_start_date" in reason


def test_only_verified_non_demo_rows_are_used(tmp_path):
    p = tmp_path / "incidents.csv"
    p.write_text(NEW_HEADER
                 + "a,2025-08-26,4,Ramban,landslide,m,n,false\n"
                 + "b,2025-08-27,4,Ramban,landslide,m,,false\n"
                 + "c,2025-08-28,4,Ramban,landslide,m,n,true\n")
    rows, reason = load_incidents(p)
    assert [r.id for r in rows] == ["a"] and reason is None


def test_preview_reads_old_rows(tmp_path):
    p = tmp_path / "incidents.csv"
    p.write_text("date,zone_id,place,hazard_type\n2019-05-09,4,Digdol,landslide\n")
    rows, _ = load_incidents(p, include_unverified=True)
    assert rows[0].day == date(2019, 5, 9)


# --- report and files ------------------------------------------------------------------------
def test_not_run_report_and_page():
    report = backtest.build_report([], "no verified incidents in incidents.csv yet", POINTS, None, CFG, date(2026, 11, 25))
    assert report["status"] == "not_run" and report["caveats"]
    md = render_md(report)
    assert "Not run yet: no verified incidents" in md and "UNVERIFIED" not in md


def test_ok_report_counts_hits(monkeypatch):
    monkeypatch.setattr(backtest, "false_alarms", lambda *a, **k: {
        "from": "2024-02-06", "to": "2026-10-31", "lead_h": 24, "per_zone": {"4": {"alarm_days": 0, "days_scored": 1}},
        "alarm_days": 0, "zone_days_scored": 1, "alarm_days_per_zone_per_30_days": 0.0})
    report = backtest.build_report([incident()], None, POINTS, FakeFetcher(rain_mm=120), CFG, date(2026, 11, 25))
    assert report["status"] == "ok"
    assert report["hit_rate"]["48h"] == {"hits": 1, "of": 1}
    assert report["median_lead_time_h"] == 48
    md = render_md(report)
    assert "| Forecast 48 h ahead | 1 of 1 | 1 of 1 |" in md and "1 verified incidents" in md


def test_preview_never_writes_files(monkeypatch, tmp_path):
    csv_path = tmp_path / "incidents.csv"
    csv_path.write_text("date,zone_id,place,hazard_type\n2025-08-26,4,Ramban,landslide\n")
    monkeypatch.setattr(backtest, "OUT_JSON", tmp_path / "backtest.json")
    monkeypatch.setattr(backtest, "OUT_MD", tmp_path / "backtest.md")
    monkeypatch.setattr(backtest, "Fetcher", lambda: FakeFetcher(rain_mm=120))
    monkeypatch.setattr(backtest, "false_alarms", lambda *a, **k: {
        "from": "x", "to": "y", "lead_h": 24, "per_zone": {}, "alarm_days": 0, "zone_days_scored": 0,
        "alarm_days_per_zone_per_30_days": None})
    assert backtest.main(["--incidents", str(csv_path), "--preview-unverified"]) == 0
    assert not (tmp_path / "backtest.json").exists() and not (tmp_path / "backtest.md").exists()
