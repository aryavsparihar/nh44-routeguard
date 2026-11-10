"""Build fake weather series for tests. No network."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from risk.weather import Hour, Series

T = datetime(2026, 11, 10, 12, tzinfo=timezone.utc)  # the forecast time being scored


def series(
    hours: int = 96,
    end: datetime = T,
    rain: dict[int, float] | None = None,
    snow: dict[int, float] | None = None,
    depth: float = 0.0,
    temp: float | dict[int, float] = 5.0,
) -> Series:
    """`hours` hourly rows ending at `end`. Dicts are keyed by "hours before end"
    (0 = the hour ending at `end`)."""
    rain, snow = rain or {}, snow or {}
    out = []
    for back in range(hours - 1, -1, -1):
        t_c = temp.get(back, 5.0) if isinstance(temp, dict) else temp
        out.append(Hour(
            time=end - timedelta(hours=back),
            precip_mm=rain.get(back, 0.0),
            snowfall_cm=snow.get(back, 0.0),
            snow_depth_m=depth,
            temp_c=t_c,
        ))
    return Series(out)


def spread(total: float, first_back: int, n: int) -> dict[int, float]:
    """`total` mm spread evenly over n hours starting `first_back` hours before end."""
    return {first_back + i: total / n for i in range(n)}
