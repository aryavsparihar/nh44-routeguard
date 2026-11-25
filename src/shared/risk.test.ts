import { describe, expect, it } from "vitest";
import { levelFor, worstZone, type RiskRow } from "./risk";

function row(zone: number, overall: number, extra: Partial<RiskRow> = {}): RiskRow {
  return {
    zone_id: zone,
    horizon_hours: 0,
    overall,
    risk_low: overall,
    risk_high: overall,
    level: levelFor(overall),
    top_hazard: overall > 0 ? "landslide" : null,
    confidence: "low",
    hazards: { landslide: overall, rockfall: 0, flash_flood: 0, snow_ice: 0 },
    reason: "",
    reason_code: overall > 0 ? "landslide_rain" : "none",
    reason_params: overall > 0 ? { exposure: "some" } : { zone },
    ...extra,
  };
}

describe("levelFor", () => {
  it("uses the job's cut-offs (0.30 and 0.65)", () => {
    expect(levelFor(0.29)).toBe("low");
    expect(levelFor(0.3)).toBe("medium");
    expect(levelFor(0.65)).toBe("medium");
    expect(levelFor(0.66)).toBe("high");
  });
});

describe("worstZone (L2)", () => {
  it("says all low when nothing is above low, never 'zone 1'", () => {
    expect(worstZone([1, 2, 3, 4, 5, 6].map((z) => row(z, 0)))).toEqual({ kind: "all_low" });
    expect(worstZone([row(1, 0.2), row(2, 0.29)])).toEqual({ kind: "all_low" });
  });

  it("picks the highest level, then the highest score", () => {
    const w = worstZone([row(1, 0.5), row(2, 0.7), row(3, 0.9), row(4, 0.4)]);
    expect(w.kind === "worst" && w.row.zone_id).toBe(3);
  });

  it("breaks a tied score by exposure, then by zone order", () => {
    const tied = [
      row(2, 0.5, { reason_params: { exposure: "some" } }),
      row(4, 0.5, { reason_params: { exposure: "very_high" } }),
      row(3, 0.5, { reason_params: { exposure: "very_high" } }),
    ];
    const w = worstZone(tied);
    expect(w.kind === "worst" && w.row.zone_id).toBe(3);
  });

  it("uses one hazard's score when the filter is on", () => {
    const rows = [
      row(1, 0.7),
      row(2, 0.4, { hazards: { landslide: 0, rockfall: 0, flash_flood: 0, snow_ice: 0.8 } }),
    ];
    const w = worstZone(rows, "snow_ice");
    expect(w.kind === "worst" && w.row.zone_id).toBe(2);
    expect(worstZone(rows, "flash_flood")).toEqual({ kind: "all_low" });
  });
});
