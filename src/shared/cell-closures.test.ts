import { describe, expect, it } from "vitest";
import type { PastClosure } from "./api-types";
import { MAX_KM, cellCentre, closuresByCell } from "./cell-closures";

// A small hexagon-ish ring around a centre, [lng, lat], closed.
function cell(id: string, lat: number, lng: number, r = 0.004) {
  const ring: [number, number][] = [];
  for (let i = 0; i < 6; i++) ring.push([lng + r * Math.cos((i * Math.PI) / 3), lat + r * Math.sin((i * Math.PI) / 3)]);
  ring.push(ring[0]);
  return { id, boundary: ring };
}

function closure(id: number, date: string, lat: number | null, lng: number | null): PastClosure {
  return {
    id,
    date,
    end_date: date,
    zone_id: 5,
    place: "Ramsoo",
    lat,
    lng,
    hazard_type: "landslide",
    hours_closed: 9,
    vehicles_stranded: null,
    source_url: "https://example.org/a",
    source_publisher: "PTI",
    confidence: "high",
  };
}

const cells = [cell("a", 33.3365, 75.1924), cell("b", 33.35, 75.2)];

describe("cellCentre", () => {
  it("is the middle of the ring, ignoring the repeated first corner", () => {
    const c = cellCentre(cell("a", 33.3, 75.1).boundary);
    expect(c.lat).toBeCloseTo(33.3, 6);
    expect(c.lng).toBeCloseTo(75.1, 6);
  });
});

describe("closuresByCell", () => {
  it("gives each closure to its nearest cell only, newest first", () => {
    const out = closuresByCell(cells, [closure(1, "2018-02-06", 33.3366, 75.1925), closure(2, "2024-04-16", 33.337, 75.193), closure(3, "2020-01-01", 33.3499, 75.2001)]);
    expect(out.get("a")?.map((c) => c.id)).toEqual([2, 1]);
    expect(out.get("b")?.map((c) => c.id)).toEqual([3]);
  });

  it(`leaves out closures more than ${MAX_KM} km from every cell, or with no position`, () => {
    const out = closuresByCell(cells, [closure(1, "2018-02-06", 33.5, 75.5), closure(2, "2019-01-01", null, null)]);
    expect(out.size).toBe(0);
  });

  it("gives nothing when the map has no cells", () => {
    expect(closuresByCell([], [closure(1, "2018-02-06", 33.3365, 75.1924)]).size).toBe(0);
  });
});
