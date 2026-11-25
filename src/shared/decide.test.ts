import { describe, expect, it } from "vitest";
import { decide, type Lot, type RoadStatus } from "./decide";
import { levelFor, type RiskRow } from "./risk";

// Risk rows for all 6 zones and 4 times; `scores[zone][horizon]` overrides 0.
function run(scores: Record<number, Record<number, number>> = {}): { rows: RiskRow[]; run_at: string } {
  const rows: RiskRow[] = [];
  for (const h of [0, 12, 24, 48] as const) {
    for (const z of [1, 2, 3, 4, 5, 6]) {
      const overall = scores[z]?.[h] ?? 0;
      rows.push({
        zone_id: z,
        horizon_hours: h,
        overall,
        risk_low: overall,
        risk_high: overall,
        level: levelFor(overall),
        top_hazard: overall ? "landslide" : null,
        confidence: "medium",
        hazards: { landslide: overall, rockfall: 0, flash_flood: 0, snow_ice: 0 },
        reason: "",
        reason_code: "none",
        reason_params: { zone: z },
      });
    }
  }
  return { rows, run_at: "2026-11-25T06:37:14.000Z" };
}

const lot: Lot = { variety: "delicious", days_since_picking: 12, tonnes: 10, destination: "azadpur", truck_type: "heavy" };
const unknown: RoadStatus = { mughal_road: "unknown", rail_parcel: "unknown" };
const allOpen: RoadStatus = { mughal_road: "open", rail_parcel: "open" };

describe("decide", () => {
  it("SEND when every zone on the route is low for 24 h", () => {
    const a = decide(lot, run(), unknown);
    expect(a).toMatchObject({ decision: "SEND", reason_code: "send_low", reason_params: { zones: 6 }, notes: [] });
    expect(a.risk_run_at).toBe("2026-11-25T06:37:14.000Z");
  });

  it("HOLD when a zone is medium, naming the worst zone and time", () => {
    const a = decide(lot, run({ 4: { 12: 0.4 }, 3: { 24: 0.5 } }), unknown);
    expect(a).toMatchObject({ decision: "HOLD", reason_code: "hold_medium", reason_params: { zone: 3, horizon: 24 }, delay_hours: 6 });
  });

  it("DIVERT a light truck by Mughal Road only when an admin marked it open (L14)", () => {
    const light = { ...lot, truck_type: "light" as const };
    const medium = run({ 4: { 0: 0.5 } });
    expect(decide(light, medium, allOpen)).toMatchObject({ decision: "DIVERT", reason_code: "divert_mughal" });
    expect(decide(light, medium, unknown)).toMatchObject({ decision: "HOLD", notes: ["mughal_unknown"] });
    expect(decide(light, medium, { ...allOpen, mughal_road: "closed" })).toMatchObject({ decision: "HOLD", notes: ["mughal_closed"] });
    // A heavy truck never gets Mughal Road.
    expect(decide(lot, medium, allOpen)).toMatchObject({ decision: "HOLD", notes: [] });
  });

  it("RAIL when the road stays high for 48 h, the fruit is ageing and the train runs", () => {
    const shut = run({ 4: { 0: 0.9, 12: 0.9, 24: 0.9, 48: 0.9 } });
    expect(decide(lot, shut, allOpen)).toMatchObject({
      decision: "RAIL",
      reason_code: "rail_high",
      reason_params: { zones: "4", pct: 57 },
    });
  });

  it("does not suggest RAIL when the train's status is unknown or stopped (L14)", () => {
    const shut = run({ 4: { 0: 0.9, 12: 0.9, 24: 0.9, 48: 0.9 } });
    expect(decide(lot, shut, unknown)).toMatchObject({ decision: "DIVERT", reason_code: "divert_store", notes: ["rail_unknown"] });
    expect(decide(lot, shut, { ...allOpen, rail_parcel: "closed" })).toMatchObject({ notes: ["rail_closed"] });
  });

  it("DIVERT to a store when the fruit can still wait", () => {
    const shut = run({ 4: { 0: 0.9, 12: 0.9, 24: 0.9, 48: 0.9 } });
    const fresh = { ...lot, days_since_picking: 2 };
    expect(decide(fresh, shut, allOpen)).toMatchObject({ decision: "DIVERT", reason_code: "divert_store", notes: [] });
  });

  it("only looks at zones on the route", () => {
    const valley = { ...lot, destination: "parimpora" as const };
    expect(decide(valley, run({ 4: { 0: 0.9 } }), unknown).decision).toBe("SEND");
    expect(decide(valley, run({ 6: { 0: 0.9 } }), unknown)).toMatchObject({ decision: "DIVERT", reason_code: "divert_store_valley" });
  });

  it("HOLDs when there are no scores, rather than saying it is safe", () => {
    expect(decide(lot, { rows: [], run_at: null }, unknown)).toMatchObject({ decision: "HOLD", notes: ["no_scores"] });
  });
});
