import { describe, expect, it } from "vitest";
import { STALE_AFTER_MINUTES, dataAgeMinutes, isStale } from "./freshness";

const NOW = new Date("2026-11-24T18:00:00Z");

describe("dataAgeMinutes", () => {
  it("counts whole minutes", () => {
    expect(dataAgeMinutes("2026-11-24T17:07:00Z", NOW)).toBe(53);
    expect(dataAgeMinutes("2026-11-24T16:29:30Z", NOW)).toBe(90); // 90.5 min
  });

  it("treats a time in the future as 0", () => {
    expect(dataAgeMinutes("2026-11-24T18:02:00Z", NOW)).toBe(0);
  });
});

describe("isStale", () => {
  it("is fresh up to and including 90 minutes", () => {
    expect(STALE_AFTER_MINUTES).toBe(90);
    expect(isStale(0)).toBe(false);
    expect(isStale(90)).toBe(false);
  });

  it("is stale from 91 minutes, and when there is no run yet", () => {
    expect(isStale(91)).toBe(true);
    expect(isStale(null)).toBe(true);
  });
});
