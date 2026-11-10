"""Hourly weather series for one point, and helpers to read time windows from it.

Open-Meteo hourly values are totals for the hour ENDING at the timestamp
(precipitation at 10:00 = rain between 09:00 and 10:00). So "the 72 h window
ending at T" is every hour t with T - 72 h < t <= T.
All times are UTC.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class Hour:
    time: datetime  # UTC, end of the hour
    precip_mm: float | None = None
    snowfall_cm: float | None = None
    snow_depth_m: float | None = None
    temp_c: float | None = None


class DataGapError(ValueError):
    """The series does not cover the time we need to score."""


class Series:
    def __init__(self, hours: list[Hour]):
        self.hours = sorted(hours, key=lambda h: h.time)
        self._by_time = {h.time: h for h in self.hours}

    def __len__(self) -> int:
        return len(self.hours)

    def at(self, t: datetime) -> Hour:
        try:
            return self._by_time[t]
        except KeyError:
            raise DataGapError(f"no weather data for {t.isoformat()}") from None

    def window(self, end: datetime, hours: int) -> list[Hour]:
        """Hours t with end - hours < t <= end."""
        self.at(end)  # the end of the window must exist
        start = end - timedelta(hours=hours)
        return [h for h in self.hours if start < h.time <= end]

    def total(self, end: datetime, hours: int, field: str) -> float:
        return sum(getattr(h, field) or 0.0 for h in self.window(end, hours))
