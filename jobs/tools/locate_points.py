"""Find the weather points along NH-44 and write jobs/points.json.

How it works
1. Get the NH-44 road line: a Jammu -> Srinagar driving route from the public
   OSRM server (OpenStreetMap roads; ~80% of it is tagged ref=NH44 in OSM).
   The line is only used for the distance check below. It is NOT saved to /data
   (the corridor hexes are Navaya's job).
2. Look up each place on Nominatim (OpenStreetMap search), max 1 request/second.
3. Prefer real places (town/village/hamlet/...) over other objects, skip
   administrative boundaries (their centre point can be far from the town), and
   accept a candidate only if it is within MAX_KM of the line. Anything else is
   listed as "not placed" so we can pick it by hand.
4. Warn when a point's distance along the road ("km_from_jammu") is out of the
   order the places are listed in, so a wrong same-name match stands out.

Run:  jobs/.venv/bin/python jobs/tools/locate_points.py
"""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "jobs" / "points.json"

UA = {"User-Agent": "risk-job-geocoder/0.1 (hackathon research script)"}
NOMINATIM = "https://nominatim.openstreetmap.org/search"
OSRM = "https://router.project-osrm.org/route/v1/driving/{a};{b}?overview=full&geometries=geojson"
JAMMU = "74.857,32.726"
SRINAGAR = "74.797,34.084"
# lon_min, lat_max, lon_max, lat_min: a box around the Jammu-Srinagar corridor
VIEWBOX = "74.70,34.20,75.45,32.60"
MAX_KM = 2.0

# (zone_id, id, display name, Nominatim queries to try in order, kind)
# kind "place" = take the place itself; "tunnel_south" = southern end of a tunnel way
PLACES: list[tuple[int, str, str, list[str], str]] = [
    (1, "z1_nagrota", "Nagrota", ["Nagrota"], "place"),
    (1, "z1_jakhani", "Udhampur (Jakhani)", ["Jakhani", "Udhampur"], "place"),
    (2, "z2_dewal", "Dewal", ["Dewal"], "place"),
    (2, "z2_kheri", "Kheri", ["Kheri"], "place"),
    (2, "z2_samroli", "Samroli", ["Samroli"], "place"),
    (2, "z2_chenani", "Chenani", ["Chenani"], "place"),
    (3, "z3_nashri", "Nashri", ["Nashri"], "place"),
    (3, "z3_dalwas", "Dalwas", ["Dalwas"], "place"),
    (3, "z3_peerah", "Peerah", ["Peerah", "Peera"], "place"),
    (3, "z3_seri", "Seri", ["Seri"], "place"),
    (3, "z3_mehar", "Mehar / Cafeteria Morh", ["Mehar", "Cafeteria Morh"], "place"),
    (4, "z4_ramban", "Ramban", ["Ramban"], "place"),
    (4, "z4_battery_chashma", "Battery Chashma", ["Battery Chashma"], "place"),
    (4, "z4_digdol", "Digdol", ["Digdol", "Digdaal"], "place"),  # OSM spells it "Digdaal"
    (4, "z4_marog", "Marog", ["Marog"], "place"),
    (4, "z4_khooni_nallah", "Khooni Nallah", ["Khooni Nallah", "Khooni Nala"], "place"),
    (5, "z5_ramsoo", "Ramsoo", ["Ramsoo", "Ramsu"], "place"),
    (5, "z5_banihal", "Banihal", ["Banihal"], "place"),
    (5, "z5_navyug_south", "Navyug tunnel (Banihal side)",
     ["Navyug Tunnel", "Banihal Qazigund Tunnel", "Banihal-Qazigund Road Tunnel"], "tunnel_south"),
    (5, "z5_qazigund", "Qazigund", ["Qazigund"], "place"),
    (6, "z6_bijbehara", "Anantnag (Bijbehara)", ["Bijbehara", "Anantnag"], "place"),
    (6, "z6_srinagar", "Srinagar", ["Srinagar"], "place"),
]


def road_line(client: httpx.Client) -> list[tuple[float, float]]:
    r = client.get(OSRM.format(a=JAMMU, b=SRINAGAR), timeout=60)
    r.raise_for_status()
    coords = r.json()["routes"][0]["geometry"]["coordinates"]
    return [(lat, lng) for lng, lat in coords]


def _xy(lat: float, lng: float, lat0: float) -> tuple[float, float]:
    return lng * 111.320 * math.cos(math.radians(lat0)), lat * 110.574


def distance_to_line(lat: float, lng: float, line: list[tuple[float, float]]) -> tuple[float, float]:
    """Return (km to the nearest point of the line, km along the line from Jammu)."""
    px, py = _xy(lat, lng, lat)
    best, best_chain, chain = float("inf"), 0.0, 0.0
    for (a_lat, a_lng), (b_lat, b_lng) in zip(line, line[1:]):
        ax, ay = _xy(a_lat, a_lng, lat)
        bx, by = _xy(b_lat, b_lng, lat)
        dx, dy = bx - ax, by - ay
        seg = math.hypot(dx, dy)
        t = 0.0 if seg == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg**2))
        d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
        if d < best:
            best, best_chain = d, chain + t * seg
        chain += seg
    return best, best_chain


def search(client: httpx.Client, q: str, want_geom: bool) -> list[dict]:
    params = {"q": q, "format": "jsonv2", "viewbox": VIEWBOX, "bounded": 1, "limit": 10, "countrycodes": "in"}
    if want_geom:
        params["polygon_geojson"] = 1
    r = client.get(NOMINATIM, params=params, timeout=60)
    time.sleep(1.1)  # Nominatim usage policy: max 1 request per second
    r.raise_for_status()
    return r.json()


PLACE_TYPES = {"city", "town", "village", "hamlet", "suburb", "locality", "neighbourhood", "isolated_dwelling"}


def is_place(hit: dict) -> bool:
    return hit.get("category") == "place" and hit.get("type") in PLACE_TYPES


def candidate_point(hit: dict, kind: str) -> tuple[float, float] | None:
    if kind == "tunnel_south":
        g = hit.get("geojson") or {}
        if g.get("type") != "LineString":
            return None
        lng, lat = min(g["coordinates"], key=lambda c: c[1])  # southern (Banihal) end
        return lat, lng
    return float(hit["lat"]), float(hit["lon"])


def main() -> int:
    with httpx.Client(headers=UA) as client:
        line = road_line(client)
        print(f"Road line: {len(line)} vertices from OSRM")
        points, unplaced = [], []
        for zone_id, pid, name, queries, kind in PLACES:
            best = None  # ranked by (is a real place, closeness to the road)
            for q in queries:
                for hit in search(client, q, want_geom=(kind == "tunnel_south")):
                    if hit.get("category") == "boundary":
                        continue
                    pt = candidate_point(hit, kind)
                    if pt is None:
                        continue
                    d, chain = distance_to_line(pt[0], pt[1], line)
                    good = kind == "tunnel_south" or is_place(hit)
                    rank = (0 if good and d <= MAX_KM else 1, d)
                    if best is None or rank < best["rank"]:
                        best = {"q": q, "hit": hit, "pt": pt, "d": d, "chain": chain, "rank": rank}
                if best and best["rank"][0] == 0:
                    break  # found a real place near the road; no need to try other spellings
            if best is None or best["d"] > MAX_KM:
                near = f"closest hit {best['d']:.1f} km away ({best['hit']['display_name'][:60]})" if best else "no hits"
                unplaced.append({"id": pid, "name": name, "zone_id": zone_id, "why": near})
                print(f"  NOT PLACED  z{zone_id} {name}: {near}")
                continue
            h = best["hit"]
            end = " southern end of" if kind == "tunnel_south" else ""
            points.append({
                "id": pid,
                "name": name,
                "zone_id": zone_id,
                "lat": round(best["pt"][0], 5),
                "lng": round(best["pt"][1], 5),
                "source": (
                    f"Nominatim '{best['q']}' ->{end} OSM {h['osm_type']} {h['osm_id']} "
                    f"({h.get('category')}={h.get('type')}); {best['d']:.2f} km from NH-44 line"
                ),
                "km_from_jammu": round(best["chain"], 1),
                "_fallback_query": best["q"] != queries[0],
            })
            print(f"  ok  z{zone_id} {name:30s} {best['d']:.2f} km off road, km {best['chain']:.0f}")

    warnings = []
    for a, b in zip(points, points[1:]):
        if b["km_from_jammu"] < a["km_from_jammu"]:
            warnings.append(f"{b['name']} (zone {b['zone_id']}, km {b['km_from_jammu']}) comes before "
                            f"{a['name']} (zone {a['zone_id']}, km {a['km_from_jammu']}) along the road")
    for p in points:
        if p.pop("_fallback_query"):
            warnings.append(f"{p['name']}: found under another name/spelling, please confirm ({p['source'][:70]})")
    for w in warnings:
        print("  WARN", w)

    OUT.write_text(json.dumps({
        "_note": "Weather points along NH-44. Located with OpenStreetMap (Nominatim), each checked to be "
                 f"within {MAX_KM:g} km of the NH-44 road line (OSRM route on OSM). Regenerate with "
                 "jobs/tools/locate_points.py; fix by hand only with a note in 'source'.",
        "points": points,
        "not_placed": unplaced,
        "warnings": warnings,
    }, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(points)} points, {len(unplaced)} not placed -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
