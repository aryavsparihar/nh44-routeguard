import { describe, expect, it } from "vitest";
import { levelFor, type RiskRow } from "./risk";
import { truckRisk, truckZones } from "./truck-risk";

function rows(scores: Record<number, Record<number, number>> = {}, zones = [1, 2, 3, 4, 5, 6]): RiskRow[] {
  const out: RiskRow[] = [];
  for (const h of [0, 12, 24, 48] as const) {
    for (const z of zones) {
      const overall = scores[z]?.[h] ?? 0;
      out.push({
        zone_id: z,
        horizon_hours: h,
        overall,
        risk_low: overall,
        risk_high: overall,
        level: levelFor(overall),
        top_hazard: null,
        confidence: "medium",
        hazards: { landslide: overall, rockfall: 0, flash_flood: 0, snow_ice: 0 },
        reason: "",
        reason_code: "none",
        reason_params: { zone: z },
      });
    }
  }
  return out;
}

// The seed's moving truck near Ramsoo (zone 5) going to Narwal (Jammu).
const moving = { status: "moving" as const, destination: "narwal", last_lat: 33.34, last_lng: 75.19 };
const planned = { status: "planned" as const, destination: "azadpur", last_lat: null, last_lng: null };

describe("truckZones", () => {
  it("finds the zone from the last position and the next one towards Jammu", () => {
    expect(truckZones(moving)).toEqual({ current: 5, next: 4 });
  });

  it("uses the start of the route for a truck not seen on the road yet", () => {
    expect(truckZones(planned)).toEqual({ current: null, next: 6 });
    expect(truckZones({ ...moving, last_lat: 28.6, last_lng: 77.2 })).toEqual({ current: null, next: 6 }); // Delhi
  });

  it("has nothing for trucks off the road, or an unknown destination", () => {
    for (const status of ["delivered", "on_rail", "diverted"] as const) expect(truckZones({ ...moving, status })).toBeNull();
    expect(truckZones({ ...moving, destination: "nowhere" })).toBeNull();
  });
});

describe("truckRisk", () => {
  it("marks a truck whose current zone is high now or within 12 h", () => {
    expect(truckRisk({ current: 5, next: 4 }, rows({ 5: { 12: 0.9 } }))).toEqual({ kind: "high", zone: 5, hours: 12, which: "current" });
  });

  it("marks a truck whose next zone is high", () => {
    expect(truckRisk({ current: 5, next: 4 }, rows({ 4: { 0: 0.9 } }))).toEqual({ kind: "high", zone: 4, hours: 0, which: "next" });
  });

  it("doesn't mark high risk later than 12 h, or in zones it has passed", () => {
    expect(truckRisk({ current: 5, next: 4 }, rows({ 5: { 24: 0.9, 48: 0.9 } }))).toEqual({ kind: "clear" });
    expect(truckRisk({ current: 5, next: 4 }, rows({ 6: { 0: 0.9 }, 3: { 0: 0.9 } }))).toEqual({ kind: "clear" });
    expect(truckRisk({ current: 5, next: 4 }, rows({ 5: { 0: 0.5 } }))).toEqual({ kind: "clear" }); // medium
  });

  it("says unknown, not clear, when the scores are missing", () => {
    expect(truckRisk({ current: 5, next: 4 }, [])).toEqual({ kind: "unknown" });
    expect(truckRisk({ current: 5, next: 4 }, rows({}, [1, 2, 3, 4]))).toEqual({ kind: "unknown" });
    // Still marks when the zone it does have is high.
    expect(truckRisk({ current: 5, next: 4 }, rows({ 4: { 0: 0.9 } }, [4]))).toMatchObject({ kind: "high", zone: 4 });
  });

  it("has no mark for a truck off the road", () => {
    expect(truckRisk(null, rows({ 5: { 0: 0.9 } }))).toEqual({ kind: "clear" });
  });
});
