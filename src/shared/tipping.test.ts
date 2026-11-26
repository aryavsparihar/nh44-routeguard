import { describe, expect, it } from "vitest";
import cases from "@/jobs/tests/fixtures/tipping_cases.json";
import { levelFor } from "./risk";
import { landslideScore, slopeFactor, tippingPoint } from "./tipping";

const cell = (zone: number | null, slope: number | null, reasonCode: string | null = null, reasonParams: Record<string, unknown> | null = null) =>
  tippingPoint({ zone, slope, reasonCode, reasonParams });

describe("tippingPoint", () => {
  // The same table jobs/tests/test_tipping.py checks against the job itself.
  it.each(cases.cases)("zone $zone, slope $slope: medium $medium_mm mm, high $high_mm mm", (c) => {
    const t = cell(c.zone, c.slope)!;
    expect(t.medium).toEqual(c.medium_mm === null ? null : { mm: c.medium_mm });
    expect(t.high).toEqual(c.high_mm === null ? null : { mm: c.high_mm });
  });

  it("is the smallest whole mm: one less is a level lower", () => {
    for (const c of cases.cases) {
      const t = cell(c.zone, c.slope)!;
      if (t.medium) {
        expect(levelFor(landslideScore(t.medium.mm, t.max))).not.toBe("low");
        expect(levelFor(landslideScore(t.medium.mm - 1, t.max))).toBe("low");
      }
      if (t.high) {
        expect(levelFor(landslideScore(t.high.mm, t.max))).toBe("high");
        expect(levelFor(landslideScore(t.high.mm - 1, t.max))).not.toBe("high");
      }
    }
  });

  it("gives the highest score the cell can reach", () => {
    expect(cell(4, 17.5)!.max).toBeCloseTo(0.4);
    expect(cell(1, 35)!.max).toBeCloseTo(0.1);
    expect(cell(5, 0)!.max).toBe(0);
  });

  it("uses the 72 h rain from the reason only when landslide is its top hazard", () => {
    expect(cell(4, 35, "landslide_rain", { mm: 24, hours: 72 })!.nowMm).toBe(24);
    expect(cell(4, 35, "landslide_rain_burst", { mm: 41, hours: 72 })!.nowMm).toBe(41);
    expect(cell(4, 35, "rockfall_rain", { mm: 24, hours: 48 })!.nowMm).toBeNull();
    expect(cell(4, 35, null, null)!.nowMm).toBeNull();
  });

  it("has nothing to say for a cell with no zone", () => {
    expect(cell(null, 30)).toBeNull();
    expect(cell(99, 30)).toBeNull();
  });
});

describe("slopeFactor", () => {
  it("is slope / 35°, capped at 1, and 1 when the slope isn't known", () => {
    expect(slopeFactor(17.5)).toBeCloseTo(0.5);
    expect(slopeFactor(70)).toBe(1);
    expect(slopeFactor(null)).toBe(1);
  });
});
