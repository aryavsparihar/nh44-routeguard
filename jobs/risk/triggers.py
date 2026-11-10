"""Weather triggers for the 4 hazards. Each returns a score from 0 to 1 plus the
numbers behind it (used to write the reason sentence).

Every threshold comes from lib/risk/config.json. They are our own starting
values, not sourced figures, and will be tuned in the backtest.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from .weather import Series


@dataclass
class Trigger:
    score: float
    facts: dict[str, Any] = field(default_factory=dict)


def scale(value: float, zero_at: float, full_at: float) -> float:
    """Linear 0 at `zero_at` -> 1 at `full_at`, clamped to 0-1."""
    if full_at <= zero_at:
        raise ValueError("full_at must be above zero_at")
    return max(0.0, min(1.0, (value - zero_at) / (full_at - zero_at)))


def landslide(s: Series, t: datetime, c: dict[str, Any]) -> Trigger:
    """Rain in the last 72 h, 0 at 10 mm -> 1 at 80 mm; +0.2 if > 30 mm fell in 24 h; cap 1."""
    rain = s.total(t, c["rain_window_h"], "precip_mm")
    burst_rain = s.total(t, c["burst_window_h"], "precip_mm")
    burst = burst_rain > c["burst_mm_over"]
    score = scale(rain, c["rain_mm_zero"], c["rain_mm_full"]) + (c["burst_bonus"] if burst else 0.0)
    return Trigger(min(score, 1.0), {"rain_mm": rain, "hours": c["rain_window_h"],
                                     "burst_mm": burst_rain, "burst_hours": c["burst_window_h"], "burst": burst})


def freeze_thaw(s: Series, t: datetime, c: dict[str, Any]) -> bool:
    """True if, at some hour in the rain window ending at t, it is below freezing
    and at least `freeze_thaw_rain_mm` fell in the `freeze_thaw_after_h` hours before."""
    for h in s.window(t, c["rain_window_h"]):
        if h.temp_c is None or h.temp_c >= c["freeze_below_c"]:
            continue
        start = h.time - timedelta(hours=c["freeze_thaw_after_h"])
        rain_before = sum(x.precip_mm or 0.0 for x in s.hours if start < x.time <= h.time)
        if rain_before >= c["freeze_thaw_rain_mm"]:
            return True
    return False


def rockfall(s: Series, t: datetime, c: dict[str, Any]) -> Trigger:
    """Higher of: rain in 48 h (0 at 10 mm -> 1 at 50 mm), and freeze-thaw (0.7)."""
    rain = s.total(t, c["rain_window_h"], "precip_mm")
    rain_score = scale(rain, c["rain_mm_zero"], c["rain_mm_full"])
    ft = freeze_thaw(s, t, c)
    ft_score = c["freeze_thaw_score"] if ft else 0.0
    return Trigger(max(rain_score, ft_score), {"rain_mm": rain, "hours": c["rain_window_h"], "freeze_thaw": ft})


def flash_flood(s: Series, t: datetime, c: dict[str, Any]) -> Trigger:
    """Heaviest 3-hour rain within the window ending at t, 0 at 5 mm -> 1 at 25 mm."""
    best = 0.0
    for h in s.window(t, c["window_h"]):
        start = h.time - timedelta(hours=c["burst_hours"])
        best = max(best, sum(x.precip_mm or 0.0 for x in s.hours if start < x.time <= h.time))
    return Trigger(scale(best, c["rain_mm_zero"], c["rain_mm_full"]),
                   {"burst_mm": best, "burst_hours": c["burst_hours"]})


def snow_ice(s: Series, t: datetime, c: dict[str, Any]) -> Trigger:
    """Higher of: snowfall in 24 h (1 at 20 cm), snow depth (1 at 0.3 m), and
    black ice (0.6 if below 0 °C with rain/snow in the last 24 h or snow on the ground)."""
    snow = s.total(t, c["snowfall_window_h"], "snowfall_cm")
    now = s.at(t)
    depth = now.snow_depth_m or 0.0
    wet = s.total(t, c["black_ice_wet_window_h"], "precip_mm") > 0 or depth > 0
    freezing = now.temp_c is not None and now.temp_c < c["freeze_below_c"]
    black_ice = freezing and wet
    score = max(
        scale(snow, 0.0, c["snowfall_cm_full"]),
        scale(depth, 0.0, c["snow_depth_m_full"]),
        c["black_ice_score"] if black_ice else 0.0,
    )
    return Trigger(score, {"snow_cm": snow, "depth_m": depth, "black_ice": black_ice, "temp_c": now.temp_c})


TRIGGERS = {
    "landslide": landslide,
    "rockfall": rockfall,
    "flash_flood": flash_flood,
    "snow_ice": snow_ice,
}


def all_triggers(s: Series, t: datetime, cfg: dict[str, Any]) -> dict[str, Trigger]:
    return {name: fn(s, t, cfg["triggers"][name]) for name, fn in TRIGGERS.items()}
