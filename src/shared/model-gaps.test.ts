import { describe, expect, it } from "vitest";
import type { PublicReport, RiskHex } from "./api-types";
import { GAP_MAX_KM, modelGaps } from "./model-gaps";

// A small ring around a centre, [lng, lat], closed.
function hex(id: string, lat: number, lng: number, hazards: Partial<RiskHex["hazards"]> = {}): RiskHex {
  const ring: [number, number][] = [];
  for (let i = 0; i < 6; i++) ring.push([lng + 0.004 * Math.cos((i * Math.PI) / 3), lat + 0.004 * Math.sin((i * Math.PI) / 3)]);
  ring.push(ring[0]);
  return {
    h3_index: id,
    zone_id: 4,
    overall: 0,
    hazards: { landslide: 0.1, rockfall: 0.1, flash_flood: 0.1, snow_ice: 0.1, ...hazards },
    level: "low",
    top_hazard: null,
    confidence: "low",
    reason: "",
    reason_code: null,
    reason_params: null,
    slope_deg: 20,
    boundary: ring,
  };
}

function report(id: string, lat: number, lng: number, over: Partial<PublicReport> = {}): PublicReport {
  return {
    id,
    source: "driver",
    hazard_type: "landslide",
    lat,
    lng,
    zone_id: 4,
    note: null,
    status: "confirmed",
    confirmations: 2,
    created_at: "2026-11-26T08:00:00Z",
    expires_at: "2026-11-26T14:00:00Z",
    has_photo: false,
    is_demo: true,
    ...over,
  };
}

const cells = [hex("a", 33.2, 75.2), hex("b", 33.21, 75.2, { landslide: 0.5 })];

describe("modelGaps", () => {
  it("flags a confirmed report on a cell the model scores low for that hazard", () => {
    const gaps = modelGaps(cells, [report("r1", 33.2001, 75.2001)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ id: "a", zone: 4, hazard: "landslide", score: 0.1 });
    expect(gaps[0].reports.map((r) => r.id)).toEqual(["r1"]);
  });

  it("leaves out cells the model already scores medium or high", () => {
    expect(modelGaps(cells, [report("r1", 33.21, 75.2)])).toEqual([]);
  });

  it("compares the report's own hazard, not the cell's worst one", () => {
    const wet = [hex("a", 33.2, 75.2, { flash_flood: 0.9 })];
    expect(modelGaps(wet, [report("r1", 33.2, 75.2)])).toHaveLength(1);
    expect(modelGaps(wet, [report("r2", 33.2, 75.2, { hazard_type: "flash_flood" })])).toEqual([]);
  });

  it("ignores unconfirmed reports, and hazards the model doesn't score", () => {
    const list = [
      report("r1", 33.2, 75.2, { status: "unconfirmed" }),
      report("r2", 33.2, 75.2, { hazard_type: "accident" }),
      report("r3", 33.2, 75.2, { hazard_type: "other" }),
    ];
    expect(modelGaps(cells, list)).toEqual([]);
  });

  it("matches nothing more than 1 km from every cell centre", () => {
    expect(GAP_MAX_KM).toBe(1);
    // About 1.1 km east of cell a (at this latitude 0.01° of longitude is about 0.93 km).
    expect(modelGaps(cells, [report("r1", 33.2, 75.212)])).toEqual([]);
    expect(modelGaps([], [report("r1", 33.2, 75.2)])).toEqual([]);
  });

  it("groups by cell and hazard, most reports first, newest report first", () => {
    const far = hex("c", 33.3, 75.3);
    const gaps = modelGaps(
      [...cells, far],
      [
        report("c1", 33.3, 75.3, { created_at: "2026-11-26T09:30:00Z" }),
        report("a1", 33.2, 75.2, { created_at: "2026-11-26T07:00:00Z" }),
        report("a2", 33.2, 75.2, { created_at: "2026-11-26T09:00:00Z" }),
        report("a3", 33.2, 75.2, { hazard_type: "rockfall" }),
      ],
    );
    expect(gaps.map((g) => `${g.id}:${g.hazard}`)).toEqual(["a:landslide", "c:landslide", "a:rockfall"]);
    expect(gaps[0].reports.map((r) => r.id)).toEqual(["a2", "a1"]);
  });
});
