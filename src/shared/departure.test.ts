import { describe, expect, it } from "vitest";
import { roadLengthKm } from "./corridor";
import { cellsAlongRoad, fewestHigh, levelWhenThere, nearestHorizon, planDepartures, type CellAlong, type LevelsByHorizon } from "./departure";
import type { Level } from "./risk";

// Three cells 0, 50 and 100 km from Srinagar on a 100 km road, 10 h to drive.
const cells: CellAlong[] = [
  { id: "a", zone: 6, km: 0 },
  { id: "b", zone: 4, km: 50 },
  { id: "c", zone: 1, km: 100 },
];
const all = (level: Level) => new Map(cells.map((c) => [c.id, level]));
const levels = (over: Partial<Record<0 | 12 | 24 | 48, Record<string, Level>>> = {}): LevelsByHorizon => {
  const out: LevelsByHorizon = {};
  for (const h of [0, 12, 24, 48] as const) {
    const m = new Map(all("low"));
    for (const [id, l] of Object.entries(over[h] ?? {})) m.set(id, l);
    out[h] = m;
  }
  return out;
};

describe("nearestHorizon", () => {
  it("uses the nearest forecast time, the earlier one on a tie, nothing after +48 h", () => {
    expect([0, 5, 6, 7, 17, 18, 19, 35, 36, 37, 48].map(nearestHorizon)).toEqual([0, 0, 0, 12, 12, 12, 24, 24, 24, 48, 48]);
    expect(nearestHorizon(48.1)).toBeNull();
    expect(nearestHorizon(-1)).toBeNull();
  });
});

describe("planDepartures", () => {
  it("counts the high cells a truck reaches while they are high", () => {
    // Cell b is high at +12 h only. Leaving at +6 h reaches it at +11 h.
    const plans = planDepartures(cells, levels({ 12: { b: "high" } }), 10, [0, 6, 24]);
    expect(plans.map((p) => p.high)).toEqual([0, 1, 0]);
    expect(plans[1].firstHighZone).toBe(4);
  });

  it("counts cells reached after +48 h as having no scores", () => {
    const plans = planDepartures(cells, levels(), 10, [36, 45]);
    expect(plans[0]).toMatchObject({ unknown: 0, low: 3 });
    expect(plans[1]).toMatchObject({ unknown: 2, low: 1 }); // b at 50 h, c at 55 h
  });

  it("counts a cell with no score for that time as having no scores", () => {
    const missing = levels();
    missing[0] = new Map([["a", "low"]]);
    // a at 0 h (now, scored), b at 5 h (now, missing), c at 10 h (+12 h, scored).
    expect(planDepartures(cells, missing, 10, [0])[0]).toMatchObject({ low: 2, unknown: 1 });
  });
});

describe("fewestHigh", () => {
  it("names the later departure when it crosses fewer high cells", () => {
    const plans = planDepartures(cells, levels({ 0: { a: "high", b: "high" }, 12: { c: "high" } }), 10, [0, 6, 24]);
    // Now: a, b (now) and c (+12 h) are all high; +6 h: a (now) and c; +24 h: none.
    expect(plans.map((p) => p.high)).toEqual([3, 2, 0]);
    expect(fewestHigh(plans).map((p) => p.depart)).toEqual([24]);
  });

  it("says nothing when no time is better than now, or nothing is high", () => {
    expect(fewestHigh(planDepartures(cells, levels(), 10, [0, 6]))).toEqual([]);
    expect(fewestHigh(planDepartures(cells, levels({ 0: { a: "high" }, 12: { a: "high" }, 24: { a: "high" } }), 10, [0, 6, 24]))).toEqual([]);
  });

  it("never names a departure it can't score all the way", () => {
    const plans = planDepartures(cells, levels({ 0: { a: "high" } }), 10, [0, 45]);
    expect(plans[1].unknown).toBeGreaterThan(0);
    expect(fewestHigh(plans)).toEqual([]);
  });
});

describe("cellsAlongRoad", () => {
  it("orders real road cells from the Srinagar end", () => {
    const ring = (lat: number, lng: number): [number, number][] => [[lng, lat], [lng + 0.001, lat], [lng, lat + 0.001], [lng, lat]];
    // Banihal (zone 5) is nearer Srinagar than Ramban (zone 3).
    const out = cellsAlongRoad([
      { id: "ramban", zone: 3, boundary: ring(33.2387, 75.2404) },
      { id: "banihal", zone: 5, boundary: ring(33.4379, 75.1955) },
    ]);
    expect(out.map((c) => c.id)).toEqual(["banihal", "ramban"]);
    expect(out[1].km).toBeLessThan(roadLengthKm());
  });

  it("puts a cell's level at the time the truck reaches it", () => {
    expect(levelWhenThere(cells[2], 0, levels({ 12: { c: "high" } }), 100, 10)).toBe("high"); // at 10 h → +12
    expect(levelWhenThere(cells[0], 0, levels({ 12: { a: "high" } }), 100, 10)).toBe("low"); // at 0 h → now
  });
});
