import { describe, expect, it } from "vitest";
import { reportsInForce, updatesInForce } from "./in-force";

const NOW = Date.parse("2026-11-26T12:00:00Z");

describe("in force", () => {
  it("drops a saved report once its expiry time has passed", () => {
    const list = [
      { id: "a", expires_at: "2026-11-26T11:59:00Z" },
      { id: "b", expires_at: "2026-11-26T12:00:00Z" },
      { id: "c", expires_at: "2026-11-26T15:00:00Z" },
    ];
    expect(reportsInForce(list, NOW).map((r) => r.id)).toEqual(["c"]);
  });

  it("drops an official update after its end, and keeps one with no end", () => {
    const list = [
      { id: 1, valid_until: "2026-11-26T10:00:00Z" },
      { id: 2, valid_until: null },
      { id: 3, valid_until: "2026-11-27T10:00:00Z" },
    ];
    expect(updatesInForce(list, NOW).map((u) => u.id)).toEqual([2, 3]);
  });

  it("keeps everything before the clock is read (prerendered page)", () => {
    expect(reportsInForce([{ expires_at: "2000-01-01T00:00:00Z" }], 0)).toHaveLength(1);
    expect(updatesInForce([{ valid_until: "2000-01-01T00:00:00Z" }], 0)).toHaveLength(1);
  });
});
