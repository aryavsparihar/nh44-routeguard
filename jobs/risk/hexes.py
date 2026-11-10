"""Optional hexagon scoring and loading.

Uses data/corridor_hexes.csv (h3_index, zone_id) and data/hex_slope.csv
(h3_index, slope_deg). These files belong to Navaya; this code only reads them.
If either file is missing, everything here is skipped quietly.
"""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CORRIDOR = "corridor_hexes.csv"
SLOPE = "hex_slope.csv"


@dataclass(frozen=True)
class Hex:
    h3_index: str
    zone_id: int
    slope_deg: float | None
    lat: float
    lng: float


def _centre(h3_index: str) -> tuple[float, float]:
    import h3  # only needed when hexagon files exist

    return h3.cell_to_latlng(h3_index)


def read_hexes(data_dir: Path) -> list[Hex] | None:
    """Both CSVs present -> list of hexes. Either missing -> None."""
    corridor, slope = data_dir / CORRIDOR, data_dir / SLOPE
    if not (corridor.exists() and slope.exists()):
        return None
    with slope.open(newline="") as f:
        slopes = {r["h3_index"].strip(): float(r["slope_deg"]) for r in csv.DictReader(f) if r.get("slope_deg")}
    out = []
    with corridor.open(newline="") as f:
        for r in csv.DictReader(f):
            idx = r["h3_index"].strip()
            lat, lng = _centre(idx)
            out.append(Hex(idx, int(r["zone_id"]), slopes.get(idx), lat, lng))
    return out


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


def nearest_point(h: Hex, points: list[dict[str, Any]]) -> dict[str, Any]:
    return min(points, key=lambda p: haversine_km(h.lat, h.lng, p["lat"], p["lng"]))


def slope_factor(slope_deg: float | None, cfg: dict[str, Any]) -> float:
    """min(slope / 35°, 1). Unknown slope -> 1 (no reduction)."""
    if slope_deg is None:
        return 1.0
    return max(0.0, min(slope_deg / cfg["slope"]["full_effect_deg"], 1.0))


def hex_rows_for_db(hexes: list[Hex], points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rows for the hexes table (used by load_hexes.py)."""
    return [
        {
            "h3_index": h.h3_index,
            "zone_id": h.zone_id,
            "slope_deg": h.slope_deg,
            "centroid": f"SRID=4326;POINT({h.lng} {h.lat})",
            "weather_point_id": nearest_point(h, points)["id"],
        }
        for h in hexes
    ]
