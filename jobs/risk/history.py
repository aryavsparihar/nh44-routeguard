"""Archived Open-Meteo weather for the backtest (jobs/backtest.py).

Two sources, both free and keyless:

- Previous Runs API: what the forecast said 1 or 2 days before each hour
  (`precipitation_previous_day1`, `_previous_day2`, ...), next to the newest
  run (day 0). Filled from 1 Feb 2024 on (checked 24 Nov 2026: empty on
  15 Jan 2024). It has no `snow_depth_previous_dayN`, so snow depth always
  comes from the newest run.
- Archive API (ERA5 reanalysis): what the weather actually was, back to
  before 2018. Used for the "weather on the day" check only.

Responses are cached as JSON in jobs/.cache/backtest/ (gitignored), so a
rerun doesn't call the API again.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

import httpx

from .openmeteo import BACKOFF_S, RETRIES, TIMEOUT_S, CONNECT_TIMEOUT_S, WeatherFetchError
from .weather import Hour, Series

PREVIOUS_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECASTS_FROM = date(2024, 2, 1)
DAYS_BEFORE = (0, 1, 2)
CHUNK_DAYS = 92  # one request per point per ~3 months
CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache" / "backtest"
FIELDS = (("precipitation", "precip_mm"), ("snowfall", "snowfall_cm"), ("temperature_2m", "temp_c"))


def _var(name: str, days_before: int) -> str:
    return name if days_before == 0 else f"{name}_previous_day{days_before}"


def previous_runs_params(point: dict[str, Any], start: date, end: date) -> dict[str, Any]:
    hourly = [_var(name, d) for d in DAYS_BEFORE for name, _ in FIELDS] + ["snow_depth"]
    return {
        "latitude": f"{point['lat']:.5f}",
        "longitude": f"{point['lng']:.5f}",
        "hourly": ",".join(hourly),
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "timezone": "GMT",
    }


def archive_params(point: dict[str, Any], start: date, end: date) -> dict[str, Any]:
    return {
        "latitude": f"{point['lat']:.5f}",
        "longitude": f"{point['lng']:.5f}",
        "hourly": "precipitation,snowfall,snow_depth,temperature_2m",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "timezone": "GMT",
    }


def _times(hourly: dict[str, Any]) -> list[datetime]:
    times = hourly.get("time") or []
    if not times:
        raise WeatherFetchError("no hourly data in the response")
    return [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in times]


def _column(hourly: dict[str, Any], name: str, n: int) -> list[Any]:
    values = hourly.get(name)
    if values is None or len(values) != n:
        raise WeatherFetchError(f"'{name}' missing or wrong length")
    return values


def parse_previous_runs(raw: dict[str, Any]) -> dict[int, Series]:
    """One Series per days-before (0, 1, 2). Missing hours stay None."""
    hourly = raw.get("hourly") or {}
    times = _times(hourly)
    n = len(times)
    depth = _column(hourly, "snow_depth", n)
    out: dict[int, Series] = {}
    for d in DAYS_BEFORE:
        cols = {field: _column(hourly, _var(name, d), n) for name, field in FIELDS}
        out[d] = Series([
            Hour(time=t, snow_depth_m=depth[i], **{field: cols[field][i] for field in cols})
            for i, t in enumerate(times)
        ])
    return out


def parse_archive(raw: dict[str, Any]) -> Series:
    hourly = raw.get("hourly") or {}
    times = _times(hourly)
    n = len(times)
    cols = {name: _column(hourly, name, n) for name in ("precipitation", "snowfall", "snow_depth", "temperature_2m")}
    return Series([
        Hour(time=t, precip_mm=cols["precipitation"][i], snowfall_cm=cols["snowfall"][i],
             snow_depth_m=cols["snow_depth"][i], temp_c=cols["temperature_2m"][i])
        for i, t in enumerate(times)
    ])


def get_json(url: str, params: dict[str, Any], client: httpx.Client | None = None,
             sleep: Callable[[float], None] = time.sleep) -> dict[str, Any]:
    """GET with the same retries as the hourly job (network errors, 429, 5xx)."""
    own = client is None
    client = client or httpx.Client(timeout=httpx.Timeout(TIMEOUT_S, connect=CONNECT_TIMEOUT_S),
                                    headers={"User-Agent": "risk-job-backtest/0.1"})
    last: Exception | None = None
    try:
        for attempt in range(RETRIES + 1):
            try:
                r = client.get(url, params=params)
                if r.status_code == 429 or r.status_code >= 500:
                    raise httpx.HTTPStatusError(f"HTTP {r.status_code}", request=r.request, response=r)
                if r.status_code >= 400:
                    raise WeatherFetchError(f"Open-Meteo rejected the request: HTTP {r.status_code} {r.text[:200]}")
                data = r.json()
                if not isinstance(data, dict):
                    raise WeatherFetchError("expected one location in the response")
                return data
            except (httpx.TransportError, httpx.HTTPStatusError, ValueError) as e:
                last = e
                if attempt < RETRIES:
                    sleep(BACKOFF_S[attempt])
        raise WeatherFetchError(f"Open-Meteo failed after {RETRIES + 1} tries: {last}")
    finally:
        if own:
            client.close()


class Fetcher:
    """Fetches and caches archived weather. Pass `get` to fake the network in tests."""

    def __init__(self, cache_dir: Path | None = CACHE_DIR,
                 get: Callable[[str, dict[str, Any]], dict[str, Any]] | None = None):
        self.cache_dir = cache_dir
        self.get = get or get_json
        self.calls = 0

    def _cached(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        key = hashlib.sha256(json.dumps([url, params], sort_keys=True).encode()).hexdigest()[:24]
        path = self.cache_dir / f"{key}.json" if self.cache_dir else None
        if path and path.exists():
            return json.loads(path.read_text())
        self.calls += 1
        data = self.get(url, params)
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data))
        return data

    def previous_runs(self, point: dict[str, Any], start: date, end: date) -> dict[int, Series]:
        parts: dict[int, list[Hour]] = {d: [] for d in DAYS_BEFORE}
        for a, b in _chunks(start, end):
            for d, s in parse_previous_runs(self._cached(PREVIOUS_RUNS_URL, previous_runs_params(point, a, b))).items():
                parts[d].extend(s.hours)
        return {d: Series(hours) for d, hours in parts.items()}

    def archive(self, point: dict[str, Any], start: date, end: date) -> Series:
        hours: list[Hour] = []
        for a, b in _chunks(start, end):
            hours.extend(parse_archive(self._cached(ARCHIVE_URL, archive_params(point, a, b))).hours)
        return Series(hours)


def _chunks(start: date, end: date) -> list[tuple[date, date]]:
    out, a = [], start
    while a <= end:
        b = min(end, a + timedelta(days=CHUNK_DAYS - 1))
        out.append((a, b))
        a = b + timedelta(days=1)
    return out
