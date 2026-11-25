"""Build data/corridor_hexes.csv and data/hex_slope.csv from real data.

  jobs/.venv/bin/python jobs/tools/build_hexes.py            # write both CSVs
  jobs/.venv/bin/python jobs/tools/build_hexes.py --dry-run  # print counts only

Corridor: every H3 cell (resolution 8, about 0.8 km2 at this latitude) that the NH-44 driving
line in data/nh44_line.json passes through (OpenStreetMap via OSRM, ~100 m
between points; we fill the gaps every 50 m so no cell is skipped). Each cell
takes the zone of the km where the line first enters it (zone_starts_km).

Slope: elevation from the Open-Meteo Elevation API (Copernicus DEM GLO-90,
90 m, free, no key) at the cell centre and its 6 corners. slope_deg is the
steepest of the 6 centre-to-corner slopes, so a cell on a gorge road gets
the hillside's steepness, not only the road's. Values are rounded to 0.1.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import time
from pathlib import Path

import h3
import httpx

ROOT = Path(__file__).resolve().parents[2]
LINE = ROOT / "data" / "nh44_line.json"
OUT_CORRIDOR = ROOT / "data" / "corridor_hexes.csv"
OUT_SLOPE = ROOT / "data" / "hex_slope.csv"
RES = 8
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
BATCH = 100  # the API takes up to 100 coordinates per call


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def zone_at(km: float, starts: dict[str, float]) -> int:
    zone = 1
    for z, start in sorted(starts.items(), key=lambda kv: kv[1]):
        if km >= start:
            zone = int(z)
    return zone


def corridor_cells(points: list[list[float]], starts: dict[str, float]) -> dict[str, int]:
    """h3 index -> zone, in driving order (Jammu first)."""
    cells: dict[str, int] = {}
    km = 0.0
    for a, b in zip(points, points[1:]):
        seg = haversine_m(tuple(a), tuple(b))
        steps = max(1, math.ceil(seg / 50))
        for i in range(steps):
            t = i / steps
            lat, lng = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            cell = h3.latlng_to_cell(lat, lng, RES)
            cells.setdefault(cell, zone_at(km + seg * t / 1000, starts))
        km += seg / 1000
    cells.setdefault(h3.latlng_to_cell(points[-1][0], points[-1][1], RES), zone_at(km, starts))
    return cells


def elevations(coords: list[tuple[float, float]]) -> list[float]:
    out: list[float] = []
    with httpx.Client(timeout=30) as client:
        for i in range(0, len(coords), BATCH):
            chunk = coords[i : i + BATCH]
            params = {
                "latitude": ",".join(f"{c[0]:.5f}" for c in chunk),
                "longitude": ",".join(f"{c[1]:.5f}" for c in chunk),
            }
            for attempt in range(4):
                res = client.get(ELEVATION_URL, params=params)
                if res.status_code != 429:
                    break
                print("rate limited, waiting a minute", flush=True)
                time.sleep(65)
            res.raise_for_status()
            values = res.json()["elevation"]
            if len(values) != len(chunk):
                raise RuntimeError("elevation API returned a different number of values")
            out.extend(float(v) for v in values)
            # Each coordinate counts as one call against the free limit
            # (600 a minute): 100 every 12 s stays under it.
            print(f"elevations {len(out)}/{len(coords)}", flush=True)
            time.sleep(12)
    return out


def slopes(cells: list[str]) -> dict[str, float]:
    coords: list[tuple[float, float]] = []
    shapes: list[tuple[str, tuple[float, float], list[tuple[float, float]]]] = []
    for c in cells:
        centre = h3.cell_to_latlng(c)
        corners = list(h3.cell_to_boundary(c))
        shapes.append((c, centre, corners))
        coords.append(centre)
        coords.extend(corners)
    # Neighbouring cells share corners: ask for each point once.
    key = lambda p: (round(p[0], 5), round(p[1], 5))  # noqa: E731
    unique = list(dict.fromkeys(key(p) for p in coords))
    height = dict(zip(unique, elevations(unique)))
    out: dict[str, float] = {}
    for c, centre, corners in shapes:
        z0 = height[key(centre)]
        steepest = 0.0
        for corner in corners:
            rise = abs(height[key(corner)] - z0)
            run = haversine_m(centre, corner)
            steepest = max(steepest, math.degrees(math.atan2(rise, run)))
        out[c] = round(steepest, 1)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    line = json.loads(LINE.read_text())
    cells = corridor_cells(line["points"], line["zone_starts_km"])
    per_zone = {z: sum(1 for v in cells.values() if v == z) for z in range(1, 7)}
    print(f"{len(cells)} cells at resolution {RES}; per zone: {per_zone}")
    if args.dry_run:
        return 0

    slope = slopes(list(cells))
    with OUT_CORRIDOR.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["h3_index", "zone_id"])
        w.writerows(cells.items())
    with OUT_SLOPE.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["h3_index", "slope_deg"])
        w.writerows((c, slope[c]) for c in cells)
    vals = sorted(slope.values())
    print(f"wrote {OUT_CORRIDOR.name} and {OUT_SLOPE.name}; slope median {vals[len(vals) // 2]}°, max {vals[-1]}°")
    return 0


if __name__ == "__main__":
    sys.exit(main())
