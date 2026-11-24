"""Save the NH-44 road line (Jammu -> Srinagar) to data/nh44_line.json.

The incidents validator (scripts/validate_incidents.py) needs the line to check
that each incident is on the corridor and to work out its zone from the
coordinates. It runs in CI without network, so the line is saved once here.

How it works
1. Get a Jammu -> Srinagar driving route from the public OSRM server
   (OpenStreetMap roads), the same way jobs/tools/locate_points.py does.
2. Keep a point about every 100 m (the validator only needs ~100 m accuracy
   for a 2 km corridor check).
3. Work out where each zone starts: the km along the line of the zone's first
   place in jobs/points.json (Jakhani, Nashri, Ramban, Ramsoo, Qazigund).

Run:  jobs/.venv/bin/python jobs/tools/fetch_nh44_line.py
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from locate_points import JAMMU, OSRM, SRINAGAR, UA, distance_to_line, road_line  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "nh44_line.json"
POINTS = ROOT / "jobs" / "points.json"
STEP_KM = 0.1

# Zone N+1 starts at this place (zone boundaries, BUILD_PROMPT section 7 / zones seed).
ZONE_STARTS = {2: "z1_jakhani", 3: "z3_nashri", 4: "z4_ramban", 5: "z5_ramsoo", 6: "z5_qazigund"}


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat0 = math.radians((a[0] + b[0]) / 2)
    dx = (b[1] - a[1]) * 111.320 * math.cos(lat0)
    dy = (b[0] - a[0]) * 110.574
    return math.hypot(dx, dy)


def thin(line: list[tuple[float, float]], step_km: float = STEP_KM) -> list[tuple[float, float]]:
    """Keep the first point, then a point whenever we've moved step_km, and the last point."""
    out = [line[0]]
    for p in line[1:-1]:
        if _km(out[-1], p) >= step_km:
            out.append(p)
    out.append(line[-1])
    return out


def main() -> int:
    with httpx.Client(headers=UA) as client:
        full = road_line(client)
    line = thin(full)
    points = {p["id"]: p for p in json.loads(POINTS.read_text())["points"]}
    starts = {}
    for zone, pid in ZONE_STARTS.items():
        p = points[pid]
        _, along = distance_to_line(p["lat"], p["lng"], line)
        starts[str(zone)] = round(along, 1)
    doc = {
        "_note": (
            "NH-44 Jammu -> Srinagar driving line from the public OSRM server (OpenStreetMap data), "
            f"thinned to about one point every {int(STEP_KM * 1000)} m. zone_starts_km: km along this "
            "line where each zone begins (the zone's first place in jobs/points.json). "
            "Made by jobs/tools/fetch_nh44_line.py."
        ),
        "source": OSRM.format(a=JAMMU, b=SRINAGAR),
        "fetched_on": date.today().isoformat(),
        "zone_starts_km": starts,
        "points": [[round(lat, 5), round(lng, 5)] for lat, lng in line],
    }
    OUT.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    total = sum(_km(a, b) for a, b in zip(line, line[1:]))
    print(f"wrote {OUT.relative_to(ROOT)}: {len(line)} points, {total:.1f} km, zone starts {starts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
