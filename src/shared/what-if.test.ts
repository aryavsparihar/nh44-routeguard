import { describe, expect, it } from "vitest";
import { decide, type Lot, type RoadStatus } from "./decide";
import { levelFor, type RiskRow } from "./risk";
import { LOT_LIMITS, MAX_DAYS_CHANGE, MAX_LINES, nearbyDays, whatWouldChange } from "./what-if";

// Risk rows for all 6 zones and 4 times; `scores[zone][horizon]` overrides 0
// (the same helper as decide.test.ts).
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
const allOpen: RoadStatus = { mughal_road: "open", rail_parcel: "open" };
const shut = run({ 4: { 0: 0.9, 12: 0.9, 24: 0.9, 48: 0.9 } });

describe("whatWouldChange", () => {
  it("finds the smallest change in days that flips the answer", () => {
    // Delicious keeps 21 days and rail starts at half the shelf life used
    // (config/advice-assumptions.json): 12 days → RAIL, 10 days → DIVERT.
    expect(decide(lot, shut, allOpen).decision).toBe("RAIL");
    expect(whatWouldChange(lot, shut, allOpen)).toEqual([{ kind: "days", delta: -2, days: 10, decision: "DIVERT" }]);
  });

  it("offers the other truck when that flips the answer", () => {
    const medium = run({ 4: { 0: 0.5 } });
    expect(whatWouldChange(lot, medium, allOpen)).toEqual([{ kind: "truck", truck_type: "light", decision: "DIVERT" }]);
  });

  it("shows nothing when no nearby input changes the answer", () => {
    expect(whatWouldChange(lot, run(), allOpen)).toEqual([]);
  });

  it("every line it shows really gives that decision", () => {
    for (const days of [0, 5, 10, 11, 12, 60, 120]) {
      const here = { ...lot, days_since_picking: days };
      const lines = whatWouldChange(here, shut, allOpen);
      expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
      for (const line of lines) {
        const changed = line.kind === "days" ? { ...here, days_since_picking: line.days } : { ...here, truck_type: line.truck_type };
        expect(decide(changed, shut, allOpen).decision).toBe(line.decision);
        expect(line.decision).not.toBe(decide(here, shut, allOpen).decision);
      }
    }
  });
});

describe("nearbyDays", () => {
  it("never leaves the range decide() accepts", () => {
    expect(nearbyDays(LOT_LIMITS.days_since_picking.min).every((d) => d > 0)).toBe(true);
    expect(nearbyDays(LOT_LIMITS.days_since_picking.max).every((d) => d < 120)).toBe(true);
    expect(nearbyDays(3)).toContain(0);
    expect(nearbyDays(3)).not.toContain(-1);
    expect(nearbyDays(118)).toContain(120);
    expect(nearbyDays(118)).not.toContain(121);
  });

  it("looks at most a week away, nearest first", () => {
    expect(nearbyDays(50).slice(0, 4)).toEqual([49, 51, 48, 52]);
    expect(Math.max(...nearbyDays(50).map((d) => Math.abs(d - 50)))).toBe(MAX_DAYS_CHANGE);
  });
});
