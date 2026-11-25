import { describe, expect, it } from "vitest";
import { ASSUMPTIONS, priorityFor } from "./priority";

describe("priorityFor (L13)", () => {
  it("is shelf life used x load value, as a band with its inputs", () => {
    // 12 of 21 days used; 10 t x 1000 kg x Rs 60 = Rs 6 lakh
    expect(priorityFor({ variety: "delicious", days_since_picking: 12, tonnes: 10 })).toEqual({
      band: "high",
      shelf_used: 0.57,
      value_lakh: 6,
      shelf_days: 21,
      price_rs_per_kg: 60,
      score: 3.43,
      assumptions_version: ASSUMPTIONS.version,
    });
  });

  it("caps shelf life used at 100%", () => {
    expect(priorityFor({ variety: "ambri", days_since_picking: 120, tonnes: 1 }).shelf_used).toBe(1);
  });

  it("gives low for fresh, small lots", () => {
    expect(priorityFor({ variety: "maharaji", days_since_picking: 0, tonnes: 5 }).band).toBe("low");
  });

  it("labels every number in the config as an assumption", () => {
    expect(ASSUMPTIONS._note).toMatch(/not a sourced figure/);
    for (const v of Object.values(ASSUMPTIONS.varieties)) expect(v.note).toMatch(/not sourced/);
  });
});
