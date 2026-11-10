"""Fetch hourly weather for all points in ONE Open-Meteo forecast call."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import httpx

from .weather import Hour, Series

URL = "https://api.open-meteo.com/v1/forecast"
HOURLY = ("precipitation", "snowfall", "snow_depth", "temperature_2m")
PAST_DAYS = 3
# 3, not 2: with forecast_days=2 the data ends at 23:00 UTC tomorrow, so any
# run after 00:00 UTC today can't see 48 h ahead.
FORECAST_DAYS = 3
TIMEOUT_S = 30
RETRIES = 3  # 1 try + 3 retries
BACKOFF_S = (2, 5, 10)


class WeatherFetchError(RuntimeError):
    pass


def build_params(points: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "latitude": ",".join(f"{p['lat']:.5f}" for p in points),
        "longitude": ",".join(f"{p['lng']:.5f}" for p in points),
        "hourly": ",".join(HOURLY),
        "past_days": PAST_DAYS,
        "forecast_days": FORECAST_DAYS,
        "timezone": "GMT",
    }


def fetch_raw(points: list[dict[str, Any]], client: httpx.Client | None = None, sleep=time.sleep) -> list[dict]:
    """One request for every point. Retries on network errors, 429 and 5xx."""
    own = client is None
    client = client or httpx.Client(timeout=TIMEOUT_S, headers={"User-Agent": "risk-job/0.1"})
    last: Exception | None = None
    try:
        for attempt in range(RETRIES + 1):
            try:
                r = client.get(URL, params=build_params(points))
                if r.status_code == 429 or r.status_code >= 500:
                    raise httpx.HTTPStatusError(f"HTTP {r.status_code}", request=r.request, response=r)
                if r.status_code >= 400:  # bad request: retrying won't help
                    raise WeatherFetchError(f"Open-Meteo rejected the request: HTTP {r.status_code} {r.text[:200]}")
                data = r.json()
                return data if isinstance(data, list) else [data]
            except (httpx.TransportError, httpx.HTTPStatusError, ValueError) as e:
                last = e
                if attempt < RETRIES:
                    sleep(BACKOFF_S[attempt])
        raise WeatherFetchError(f"Open-Meteo failed after {RETRIES + 1} tries: {last}")
    finally:
        if own:
            client.close()


def parse(points: list[dict[str, Any]], raw: list[dict]) -> dict[str, Series]:
    """Check the response is complete and turn it into one Series per point id."""
    if len(raw) != len(points):
        raise WeatherFetchError(f"expected {len(points)} locations, got {len(raw)}")
    out: dict[str, Series] = {}
    for p, loc in zip(points, raw):
        hourly = loc.get("hourly") or {}
        times = hourly.get("time") or []
        for var in HOURLY:
            if len(hourly.get(var) or []) != len(times):
                raise WeatherFetchError(f"{p['id']}: '{var}' missing or wrong length")
        if not times:
            raise WeatherFetchError(f"{p['id']}: no hourly data")
        hours = [
            Hour(
                time=datetime.fromisoformat(t).replace(tzinfo=timezone.utc),
                precip_mm=hourly["precipitation"][i],
                snowfall_cm=hourly["snowfall"][i],
                snow_depth_m=hourly["snow_depth"][i],
                temp_c=hourly["temperature_2m"][i],
            )
            for i, t in enumerate(times)
        ]
        out[p["id"]] = Series(hours)
    return out


def fetch(points: list[dict[str, Any]], client: httpx.Client | None = None, sleep=time.sleep) -> dict[str, Series]:
    return parse(points, fetch_raw(points, client, sleep))


def reading_rows(points: list[dict[str, Any]], weather: dict[str, Series], now: datetime) -> list[dict[str, Any]]:
    """Rows for weather_readings. is_forecast = valid_at is after now."""
    fetched = now.isoformat()
    rows = []
    for p in points:
        loc = f"SRID=4326;POINT({p['lng']} {p['lat']})"
        for h in weather[p["id"]].hours:
            rows.append({
                "point_id": p["id"],
                "location": loc,
                "valid_at": h.time.isoformat(),
                "is_forecast": h.time > now,
                "precipitation_mm": h.precip_mm,
                "snowfall_cm": h.snowfall_cm,
                "snow_depth_m": h.snow_depth_m,
                "temperature_c": h.temp_c,
                "fetched_at": fetched,
            })
    return rows
