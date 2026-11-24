"""Validate data/incidents.csv and data/incidents_unverified.csv (BUILD_PROMPT section 14).

Nothing is loaded into the database unless this passes. CI runs it on every
pull request. Standard library only.

Run:  python3 scripts/validate_incidents.py [incidents.csv] [incidents_unverified.csv]
Exit code 1 and one line per problem if anything is wrong.
"""

from __future__ import annotations

import csv
import json
import math
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INCIDENTS = ROOT / "data" / "incidents.csv"
UNVERIFIED = ROOT / "data" / "incidents_unverified.csv"
LINE = ROOT / "data" / "nh44_line.json"

COLUMNS = [
    "id", "event_start_date", "event_end_date", "date_basis", "zone_id", "place", "lat", "lng", "coord_basis",
    "hazard_type", "hours_closed", "hours_basis", "vehicles_stranded", "trucks_stranded", "apple_trucks_mentioned",
    "source_url", "source_publisher", "source_published_date", "evidence_quote", "archive_url",
    "second_source_url", "added_by", "verified_by", "verified_on", "confidence", "notes", "is_demo",
]
UNVERIFIED_COLUMNS = COLUMNS + ["unverified_reason"]

HAZARDS = {"landslide", "rockfall", "flash_flood", "snow_ice", "accident", "other"}  # public.hazard_type
DATE_BASIS = {"stated", "inferred_weekday", "inferred_relative", "article_date"}
CONFIDENCE = {"", "low", "medium", "high"}
# osm_place: an OSM place with that name. osm_feature: another OSM object with that
# name (a tunnel, a road, a building). osm_place_nearby: the place isn't in OSM, so a
# nearby named OSM place is used and the notes say which. osm_feature_old_road: on the
# road as it ran before the Navyug tunnel opened in 2021 (Jawahar Tunnel).
COORD_BASIS = {"osm_place": 2.0, "osm_feature": 2.0, "osm_place_nearby": 2.0, "osm_feature_old_road": 4.0}
ZONE_TOLERANCE_KM = 0.5
MAX_QUOTE_WORDS = 25
NUMBER_COLUMNS = ("hours_closed", "vehicles_stranded", "trucks_stranded")
MAX_LEN = {"coord_basis": 40, "hours_basis": 200, "source_publisher": 120, "added_by": 60, "verified_by": 60,
           "notes": 500, "place": 120}


# --- geometry (same flat-earth maths as jobs/tools/locate_points.py) -------------

def _xy(lat: float, lng: float, lat0: float) -> tuple[float, float]:
    return lng * 111.320 * math.cos(math.radians(lat0)), lat * 110.574


def distance_to_line(lat: float, lng: float, line: list[list[float]]) -> tuple[float, float]:
    """(km to the nearest point of the line, km along the line from Jammu)."""
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


def zones_for_km(km: float, starts: dict[int, float], tolerance: float = ZONE_TOLERANCE_KM) -> set[int]:
    """Zones a point at this km may belong to (two near a boundary)."""
    def zone_at(k: float) -> int:
        z = 1
        for zone, start in sorted(starts.items(), key=lambda kv: kv[1]):
            if k >= start:
                z = zone
        return z
    return {zone_at(km - tolerance), zone_at(km), zone_at(km + tolerance)}


def load_line(path: Path = LINE) -> tuple[list[list[float]], dict[int, float]]:
    doc = json.loads(path.read_text())
    return doc["points"], {int(k): float(v) for k, v in doc["zone_starts_km"].items()}


# --- cell checks ------------------------------------------------------------------

def _date(v: str) -> date | None:
    try:
        return date.fromisoformat(v) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) else None
    except ValueError:
        return None


def _int(v: str) -> int | None:
    return int(v) if re.fullmatch(r"\d+", v) else None


def _num(v: str) -> float | None:
    return float(v) if re.fullmatch(r"\d+(\.\d+)?", v) else None


def words(s: str) -> int:
    return len(s.split())


def check_row(r: dict[str, str], line, starts) -> list[str]:
    e: list[str] = []
    for col, v in r.items():
        if v != v.strip() or "  " in v:
            e.append(f"{col}: stray whitespace")
        if col in MAX_LEN and len(v) > MAX_LEN[col]:
            e.append(f"{col}: longer than {MAX_LEN[col]} characters")

    start, end = _date(r["event_start_date"]), r["event_end_date"]
    if not start:
        e.append("event_start_date: not a YYYY-MM-DD date")
    if end and (not _date(end) or (start and _date(end) < start)):
        e.append("event_end_date: not a date, or before event_start_date")
    published = _date(r["source_published_date"])
    if not published:
        e.append("source_published_date: not a YYYY-MM-DD date")
    elif start and published < start:
        e.append("source_published_date: before the event")
    if r["date_basis"] not in DATE_BASIS:
        e.append(f"date_basis: must be one of {sorted(DATE_BASIS)}")
    elif r["date_basis"] == "article_date" and start and published and start != published:
        e.append("date_basis is article_date but event_start_date differs from source_published_date")

    zone = _int(r["zone_id"])
    if zone is None or not 1 <= zone <= 6:
        e.append("zone_id: must be 1 to 6")
    if r["hazard_type"] not in HAZARDS:
        e.append(f"hazard_type: must be one of {sorted(HAZARDS)}")
    expected_id = f"inc-{r['event_start_date']}-z{r['zone_id']}-{r['hazard_type']}"
    if r["id"] != expected_id:
        e.append(f"id: should be {expected_id}")
    if not r["place"]:
        e.append("place: empty")

    lat_ok = re.fullmatch(r"\d{1,2}\.\d{1,4}", r["lat"]) and re.fullmatch(r"\d{2,3}\.\d{1,4}", r["lng"])
    if not lat_ok:
        e.append("lat/lng: numbers with at most 4 decimals")
    elif r["coord_basis"] not in COORD_BASIS:
        e.append(f"coord_basis: must be one of {sorted(COORD_BASIS)}")
    else:
        off, km = distance_to_line(float(r["lat"]), float(r["lng"]), line)
        limit = COORD_BASIS[r["coord_basis"]]
        if off > limit:
            e.append(f"lat/lng: {off:.1f} km from the NH-44 line (limit {limit:g} km)")
        elif zone is not None and zone not in zones_for_km(km, starts):
            e.append(f"zone_id: the coordinates are at km {km:.1f}, which is zone {sorted(zones_for_km(km, starts))}")

    quote = r["evidence_quote"]
    if not quote:
        e.append("evidence_quote: empty (no quote, no row)")
    elif words(quote) > MAX_QUOTE_WORDS:
        e.append(f"evidence_quote: {words(quote)} words (max {MAX_QUOTE_WORDS})")
    for col in NUMBER_COLUMNS:
        v = r[col]
        if v and (_num(v) if col == "hours_closed" else _int(v)) is None:
            e.append(f"{col}: must be a whole number (hours may have decimals)")
    if r["hours_closed"] and not r["hours_basis"]:
        e.append("hours_basis: empty, but hours_closed is filled")
    if r["apple_trucks_mentioned"] not in {"", "true", "false"}:
        e.append("apple_trucks_mentioned: empty, true or false")

    if not r["source_url"]:
        e.append("source_url: empty")
    for col in ("source_url", "archive_url", "second_source_url"):
        if r[col] and not r[col].startswith("https://"):
            e.append(f"{col}: must start with https://")
    if not r["source_publisher"]:
        e.append("source_publisher: empty")

    if not r["added_by"]:
        e.append("added_by: empty")
    if r["verified_by"] and r["verified_by"].lower() == r["added_by"].lower():
        e.append("verified_by: must be a different person from added_by")
    if bool(r["verified_by"]) != bool(r["verified_on"]):
        e.append("verified_by and verified_on: fill both or neither")
    if r["verified_on"] and not _date(r["verified_on"]):
        e.append("verified_on: not a YYYY-MM-DD date")
    if r["confidence"] not in CONFIDENCE:
        e.append("confidence: low, medium or high")
    if r["is_demo"] not in {"true", "false"}:
        e.append("is_demo: true or false")
    return e


def validate_incidents(rows: list[dict[str, str]], header: list[str], line, starts) -> list[str]:
    if header != COLUMNS:
        return [f"header: expected the {len(COLUMNS)} section 14 columns in order"]
    errors: list[str] = []
    seen: dict[tuple, str] = {}
    for n, r in enumerate(rows, start=2):
        errors += [f"line {n} ({r['id'] or '?'}): {msg}" for msg in check_row(r, line, starts)]
        key = (r["event_start_date"], r["zone_id"], r["hazard_type"])
        if key in seen:
            errors.append(f"line {n}: same date, zone and hazard as {seen[key]}")
        seen.setdefault(key, r["id"])
    return errors


def validate_unverified(rows: list[dict[str, str]], header: list[str]) -> list[str]:
    if header != UNVERIFIED_COLUMNS:
        return ["unverified header: expected the section 14 columns plus unverified_reason"]
    errors = []
    ids = set()
    for n, r in enumerate(rows, start=2):
        where = f"unverified line {n} ({r['id'] or '?'})"
        if not r["id"] or r["id"] in ids:
            errors.append(f"{where}: missing or duplicate id")
        ids.add(r["id"])
        if r["verified_by"] or r["verified_on"]:
            errors.append(f"{where}: an unverified row can't have verified_by")
        if not r["unverified_reason"]:
            errors.append(f"{where}: unverified_reason is empty")
        if not r["source_url"].startswith("https://"):
            errors.append(f"{where}: source_url must start with https://")
    return errors


def read(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def main(argv: list[str]) -> int:
    inc_path = Path(argv[0]) if argv else INCIDENTS
    unv_path = Path(argv[1]) if len(argv) > 1 else UNVERIFIED
    line, starts = load_line()
    header, rows = read(inc_path)
    errors = validate_incidents(rows, header, line, starts)
    if unv_path.exists():
        errors += validate_unverified(*reversed(read(unv_path)))
    for msg in errors:
        print(msg)
    verified = sum(1 for r in rows if r.get("verified_by"))
    years = sorted({r["event_start_date"][:4] for r in rows if r.get("event_start_date")})
    span = f"{years[0]}-{years[-1]}" if years else "none"
    print(f"{inc_path.name}: {len(rows)} rows ({verified} verified), years {span}; {len(errors)} problems")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
