"""Tests for scripts/validate_incidents.py (BUILD_PROMPT section 14)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_incidents as v  # noqa: E402

# A straight north-south "road" along lng 75.2: 1 degree of latitude is ~110.6 km.
LINE = [[33.0, 75.2], [33.5, 75.2]]
STARTS = {2: 10.0, 3: 20.0, 4: 30.0, 5: 40.0, 6: 50.0}
KM = 1 / 110.574  # degrees of latitude per km


def good(**over: str) -> dict[str, str]:
    lat = 33.0 + 35 * KM  # km 35 -> zone 4
    row = {c: "" for c in v.COLUMNS}
    row.update(
        id="inc-2026-04-06-z4-landslide", event_start_date="2026-04-06", event_end_date="2026-04-09",
        date_basis="inferred_weekday", zone_id="4", place="Digdol", lat=f"{lat:.4f}", lng="75.2000",
        coord_basis="osm_place", hazard_type="landslide", source_url="https://example.org/a",
        source_publisher="Example (PTI)", source_published_date="2026-04-09",
        evidence_quote="The highway was blocked by multiple landslides early Monday.",
        added_by="Madhusudan", is_demo="false",
    )
    row.update(over)
    return row


def errors(*rows: dict[str, str]) -> list[str]:
    return v.validate_incidents(list(rows), v.COLUMNS, LINE, STARTS)


def test_a_good_row_passes():
    assert errors(good()) == []


def test_header_must_be_the_27_columns_in_order():
    assert v.validate_incidents([], v.COLUMNS[::-1], LINE, STARTS)
    assert len(v.COLUMNS) == 27


@pytest.mark.parametrize(
    ("over", "expected"),
    [
        ({"hazard_type": "mudslide", "id": "inc-2026-04-06-z4-mudslide"}, "hazard_type"),
        ({"date_basis": "guessed"}, "date_basis"),
        ({"event_end_date": "2026-04-01"}, "event_end_date"),
        ({"source_published_date": "2026-04-01"}, "before the event"),
        ({"source_url": "http://example.org/a"}, "https://"),
        ({"place": " Digdol"}, "whitespace"),
        ({"lat": "33.31651234"}, "4 decimals"),
        ({"id": "row-1"}, "id: should be"),
        ({"evidence_quote": " ".join(["word"] * 26)}, "26 words"),
        ({"evidence_quote": ""}, "evidence_quote"),
        ({"hours_closed": "9"}, "hours_basis"),
        ({"vehicles_stranded": "hundreds"}, "vehicles_stranded"),
        ({"is_demo": "yes"}, "is_demo"),
        ({"confidence": "certain"}, "confidence"),
    ],
)
def test_bad_cells_are_reported(over, expected):
    found = errors(good(**over))
    assert any(expected in e for e in found), found


def test_article_date_must_equal_the_published_date():
    assert any("article_date" in e for e in errors(good(date_basis="article_date")))
    ok = good(date_basis="article_date", event_start_date="2026-04-09", id="inc-2026-04-09-z4-landslide")
    assert errors(ok) == []


def test_point_must_be_near_the_road():
    far = good(lng="75.2500")  # ~4.6 km east of the line
    assert any("km from the NH-44 line" in e for e in errors(far))


def test_old_road_points_may_be_a_little_further():
    old = good(lng="75.2350", coord_basis="osm_feature_old_road")  # ~3.2 km east
    assert errors(old) == []


def test_zone_is_worked_out_from_the_coordinates():
    wrong = good(zone_id="5", id="inc-2026-04-06-z5-landslide")
    assert any("zone_id" in e for e in errors(wrong))


def test_either_zone_is_fine_right_at_a_boundary():
    lat = f"{33.0 + 40.2 * KM:.4f}"  # 0.2 km past the zone 5 start
    assert errors(good(lat=lat, zone_id="4")) == []
    assert errors(good(lat=lat, zone_id="5", id="inc-2026-04-06-z5-landslide")) == []


def test_verifier_must_be_someone_else_and_dated():
    assert any("different person" in e for e in errors(good(verified_by="madhusudan", verified_on="2026-11-25")))
    assert any("fill both" in e for e in errors(good(verified_by="Aryaveer")))
    assert errors(good(verified_by="Aryaveer", verified_on="2026-11-25")) == []


def test_duplicate_date_zone_hazard_is_reported():
    assert any("same date, zone and hazard" in e for e in errors(good(), good()))


def test_unverified_rows_need_a_reason_and_no_verifier():
    row = {c: "" for c in v.UNVERIFIED_COLUMNS} | {"id": "unv-1", "source_url": "https://example.org"}
    assert any("unverified_reason" in e for e in v.validate_unverified([row], v.UNVERIFIED_COLUMNS))
    row |= {"unverified_reason": "no date", "verified_by": "Aryaveer"}
    assert any("verified_by" in e for e in v.validate_unverified([row], v.UNVERIFIED_COLUMNS))


def test_the_committed_files_pass():
    """The real data/incidents.csv and incidents_unverified.csv must validate."""
    assert v.main([]) == 0
