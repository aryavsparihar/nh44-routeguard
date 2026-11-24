"""Turn per-point triggers into risk_scores rows.

score(zone, hazard) = exposure(zone, hazard) x trigger, highest across the zone's points.
overall = highest of the 4 hazards; range, level and confidence follow config.json.
All thresholds are our own starting values, not sourced figures.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Iterable

from .config import HAZARDS, exposure
from .triggers import Trigger


@dataclass(frozen=True)
class Report:
    zone_id: int | None
    hazard_type: str
    source: str  # driver | police
    status: str  # unconfirmed | confirmed | expired
    created_at: datetime


@dataclass
class HazardPick:
    score: float
    trigger: Trigger
    point_name: str
    point_id: str = ""


def r3(x: float) -> float:
    """numeric(4,3) in the database."""
    return round(x + 0.0, 3)


def pick_hazards(
    zone_id: int,
    triggers_by_point: dict[str, dict[str, Trigger]],
    point_names: dict[str, str],
    cfg: dict[str, Any],
    slope_factor: float = 1.0,
) -> dict[str, HazardPick]:
    """For each hazard, the highest exposure x trigger across the given points."""
    out: dict[str, HazardPick] = {}
    slope_hazards = set(cfg["slope"]["applies_to"])
    for hazard in HAZARDS:
        best: HazardPick | None = None
        for pid, triggers in triggers_by_point.items():
            t = triggers[hazard]
            factor = slope_factor if hazard in slope_hazards else 1.0
            score = min(1.0, exposure(cfg, zone_id, hazard) * t.score * factor)
            if best is None or score > best.score:
                best = HazardPick(score, t, point_names.get(pid, pid), pid)
        if best is None:
            raise ValueError(f"zone {zone_id} has no weather points")
        out[hazard] = best
    return out


def overall_and_top(scores: dict[str, float]) -> tuple[float, str | None]:
    """Highest score and which hazard it was. Ties go to the earlier hazard in HAZARDS.
    If every score is 0 there is no top hazard."""
    top = max(HAZARDS, key=lambda h: (scores[h], -HAZARDS.index(h)))
    overall = scores[top]
    return overall, (top if overall > 0 else None)


def score_range(overall: float, horizon_h: int, cfg: dict[str, Any]) -> tuple[float, float]:
    w = float(cfg["range_half_width"][str(horizon_h)])
    return max(0.0, overall - w), min(1.0, overall + w)


def level(overall: float, cfg: dict[str, Any]) -> str:
    """low < 0.30 <= medium <= 0.65 < high."""
    lv = cfg["levels"]
    if overall > lv["high_above"]:
        return "high"
    if overall >= lv["medium_from"]:
        return "medium"
    return "low"


def report_agrees(zone_id: int, hazard: str, reports: Iterable[Report], now: datetime, cfg: dict[str, Any]) -> bool:
    """A confirmed report, or any police update, in this zone in the last 6 h, for this hazard."""
    since = now - timedelta(hours=cfg["confidence"]["report_window_h"])
    return any(
        r.zone_id == zone_id
        and r.hazard_type == hazard
        and r.status != "expired"
        and (r.status == "confirmed" or r.source == "police")
        and since <= r.created_at <= now
        for r in reports
    )


def confidence(
    zone_id: int,
    top_hazard: str | None,
    horizon_h: int,
    cfg: dict[str, Any],
    history: set[tuple[int, str]],
    reports: Iterable[Report],
    now: datetime,
) -> str:
    """high: a report agrees. medium: history agrees (incidents, else exposure >= 0.6),
    except at 48 h. low: forecast only."""
    if top_hazard is None:
        return "low"
    if report_agrees(zone_id, top_hazard, reports, now, cfg):
        return "high"
    if horizon_h >= cfg["confidence"]["always_low_horizon_h"]:
        return "low"
    if (zone_id, top_hazard) in history:
        return "medium"
    if exposure(cfg, zone_id, top_hazard) >= cfg["confidence"]["history_exposure_min"]:
        return "medium"
    return "low"


LABELS = {"landslide": "landslides", "rockfall": "rockfall", "flash_flood": "flash floods", "snow_ice": "snow/ice"}


def exposure_words(e: float) -> str:
    if e >= 0.8:
        return "is very exposed to"
    if e >= 0.5:
        return "is exposed to"
    if e >= 0.3:
        return "is somewhat exposed to"
    return "has low exposure to"


def _num(x: float) -> str:
    return f"{x:.0f}" if x >= 10 or x == 0 else f"{x:.1f}"


def weather_phrase(hazard: str, f: dict[str, Any]) -> str:
    if hazard == "landslide":
        s = f"Landslide: {_num(f['rain_mm'])} mm rain in {f['hours']} h"
        return s + (f" ({_num(f['burst_mm'])} mm in {f['burst_hours']} h)" if f["burst"] else "")
    if hazard == "rockfall":
        s = f"Rockfall: {_num(f['rain_mm'])} mm rain in {f['hours']} h"
        return s + (", then below 0 °C" if f["freeze_thaw"] else "")
    if hazard == "flash_flood":
        return f"Flash flood: {_num(f['burst_mm'])} mm in {f['burst_hours']} h"
    parts = []
    if f["snow_cm"] > 0:
        parts.append(f"{_num(f['snow_cm'])} cm snow in 24 h")
    if f["depth_m"] > 0:
        parts.append(f"{f['depth_m']:.2f} m on the ground")
    if f["black_ice"]:
        parts.append("below 0 °C on a wet road")
    return "Snow/ice: " + (", ".join(parts) or "no snow")


def reason(zone_id: int, top_hazard: str | None, pick: HazardPick | None, cfg: dict[str, Any]) -> str:
    limit = cfg["reason_max_chars"]
    if top_hazard is None or pick is None:
        return f"Zone {zone_id}: no rain, snow or frost trigger in the window"[:limit]
    tail = f"zone {zone_id} {exposure_words(exposure(cfg, zone_id, top_hazard))} {LABELS[top_hazard]}"
    head = weather_phrase(top_hazard, pick.trigger.facts)
    text = f"{head} near {pick.point_name}; {tail}"
    if len(text) > limit:
        text = f"{head}; {tail}"
    return text if len(text) <= limit else text[: limit - 1] + "…"


def exposure_band(e: float) -> str:
    """Same cut-offs as exposure_words(), as a code the app can translate."""
    if e >= 0.8:
        return "very_high"
    if e >= 0.5:
        return "high"
    if e >= 0.3:
        return "some"
    return "low"


def _round(x: float) -> float | int:
    """The number _num() would print, as a number: whole from 10 up (and 0), else 1 decimal."""
    return int(round(x)) if x >= 10 or x == 0 else round(x, 1)


def reason_code_and_params(
    zone_id: int, top_hazard: str | None, pick: HazardPick | None, cfg: dict[str, Any]
) -> tuple[str, dict[str, Any]]:
    """The same reason as reason(), as a code plus params, so the app can show it in
    English, Hindi or Urdu. Every code is listed in lib/risk/reason_codes.json."""
    if top_hazard is None or pick is None:
        return "none", {"zone": zone_id}
    f = pick.trigger.facts
    where = {"place": pick.point_id, "zone": zone_id,
             "exposure": exposure_band(exposure(cfg, zone_id, top_hazard))}
    if top_hazard == "landslide":
        rain = {"mm": _round(f["rain_mm"]), "hours": f["hours"]}
        if f["burst"]:
            return "landslide_rain_burst", {**rain, "burst_mm": _round(f["burst_mm"]),
                                            "burst_hours": f["burst_hours"], **where}
        return "landslide_rain", {**rain, **where}
    if top_hazard == "rockfall":
        code = "rockfall_freeze_thaw" if f["freeze_thaw"] else "rockfall_rain"
        return code, {"mm": _round(f["rain_mm"]), "hours": f["hours"], **where}
    if top_hazard == "flash_flood":
        return "flash_flood_burst", {"mm": _round(f["burst_mm"]), "hours": f["burst_hours"], **where}
    return "snow_ice", {"snow_cm": _round(f["snow_cm"]), "depth_m": round(f["depth_m"], 2),
                        "black_ice": "yes" if f["black_ice"] else "no", **where}


def build_row(
    *,
    zone_id: int,
    horizon_h: int,
    picks: dict[str, HazardPick],
    cfg: dict[str, Any],
    history: set[tuple[int, str]],
    reports: Iterable[Report],
    now: datetime,
    run_at: datetime,
    h3_index: str | None = None,
) -> dict[str, Any]:
    scores = {h: r3(p.score) for h, p in picks.items()}
    overall, top = overall_and_top(scores)
    low, high = score_range(overall, horizon_h, cfg)
    top_pick = picks[top] if top else None
    code, params = reason_code_and_params(zone_id, top, top_pick, cfg)
    return {
        "run_at": run_at.isoformat(),
        "h3_index": h3_index,
        "zone_id": zone_id,
        "horizon_hours": horizon_h,
        **scores,
        "overall": overall,
        "top_hazard": top,
        "risk_low": r3(low),
        "risk_high": r3(high),
        "level": level(overall, cfg),
        "confidence": confidence(zone_id, top, horizon_h, cfg, history, reports, now),
        "reason": reason(zone_id, top, top_pick, cfg),  # English, for older clients
        "reason_code": code,
        "reason_params": params,
        "model_version": cfg["model_version"],
    }
