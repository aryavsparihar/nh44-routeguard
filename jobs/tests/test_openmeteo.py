"""Open-Meteo fetch: one call, retries, parsing, is_forecast. Uses a fake transport, no network."""

from datetime import datetime, timezone

import httpx
import pytest

from risk import openmeteo
from risk.openmeteo import WeatherFetchError, build_params, fetch, reading_rows

POINTS = [
    {"id": "a", "name": "A", "zone_id": 4, "lat": 33.2387, "lng": 75.2404},
    {"id": "b", "name": "B", "zone_id": 5, "lat": 33.4379, "lng": 75.1955},
]
TIMES = ["2026-11-10T11:00", "2026-11-10T12:00", "2026-11-10T13:00"]


def location(rain=(0.0, 1.5, 2.0)):
    return {"hourly": {"time": TIMES, "precipitation": list(rain), "snowfall": [0, 0, 0],
                       "snow_depth": [0, 0, 0], "temperature_2m": [4, 3, 2]}}


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_one_call_with_all_points_and_settings():
    calls = []

    def handler(req):
        calls.append(req)
        return httpx.Response(200, json=[location(), location()])

    fetch(POINTS, client(handler), sleep=lambda s: None)
    assert len(calls) == 1
    q = calls[0].url.params
    assert q["latitude"] == "33.23870,33.43790"
    assert q["hourly"] == "precipitation,snowfall,snow_depth,temperature_2m"
    assert (q["past_days"], q["forecast_days"], q["timezone"]) == ("3", "3", "GMT")


def test_build_params_lists_every_point():
    assert build_params(POINTS)["longitude"] == "75.24040,75.19550"


def test_retries_then_succeeds():
    n = {"i": 0}

    def handler(req):
        n["i"] += 1
        return httpx.Response(503) if n["i"] < 3 else httpx.Response(200, json=[location(), location()])

    out = fetch(POINTS, client(handler), sleep=lambda s: None)
    assert n["i"] == 3 and set(out) == {"a", "b"}


def test_gives_up_after_3_retries():
    n = {"i": 0}

    def handler(req):
        n["i"] += 1
        raise httpx.ConnectTimeout("timeout", request=req)

    with pytest.raises(WeatherFetchError):
        fetch(POINTS, client(handler), sleep=lambda s: None)
    assert n["i"] == 4  # 1 try + 3 retries


def test_bad_request_is_not_retried():
    n = {"i": 0}

    def handler(req):
        n["i"] += 1
        return httpx.Response(400, json={"reason": "bad"})

    with pytest.raises(WeatherFetchError):
        fetch(POINTS, client(handler), sleep=lambda s: None)
    assert n["i"] == 1


def test_incomplete_response_is_an_error():
    broken = location()
    del broken["hourly"]["snowfall"]
    with pytest.raises(WeatherFetchError):
        fetch(POINTS, client(lambda r: httpx.Response(200, json=[location(), broken])), sleep=lambda s: None)
    with pytest.raises(WeatherFetchError):
        fetch(POINTS, client(lambda r: httpx.Response(200, json=[location()])), sleep=lambda s: None)


def test_times_are_utc_and_is_forecast_follows_now():
    out = fetch(POINTS, client(lambda r: httpx.Response(200, json=[location(), location()])), sleep=lambda s: None)
    assert out["a"].hours[0].time == datetime(2026, 11, 10, 11, tzinfo=timezone.utc)
    now = datetime(2026, 11, 10, 12, 30, tzinfo=timezone.utc)
    rows = [r for r in reading_rows(POINTS, out, now) if r["point_id"] == "a"]
    assert [r["is_forecast"] for r in rows] == [False, False, True]
    assert rows[0]["location"] == "SRID=4326;POINT(75.2404 33.2387)"
    assert rows[1]["precipitation_mm"] == 1.5


def test_forecast_days_reaches_48h():
    # data ends at 23:00 UTC on the last forecast day; 48 h after a 23:00 run must still be inside
    assert openmeteo.FORECAST_DAYS >= 3
