import { describe, expect, it } from "vitest";
import { corridorBounds, corridorSegments, zoneAt } from "./corridor";

describe("corridorSegments", () => {
  const segments = corridorSegments();

  it("has the six zones in order, Jammu to Srinagar", () => {
    expect(segments.map((s) => s.zone)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("joins each zone to the next with no gap", () => {
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1].coords;
      expect(segments[i].coords[0]).toEqual(prev[prev.length - 1]);
    }
  });

  it("stays inside the NH-44 corridor box", () => {
    const [[west, south], [east, north]] = corridorBounds(segments);
    expect(south).toBeGreaterThan(32.6);
    expect(north).toBeLessThan(34.2);
    expect(west).toBeGreaterThan(74.7);
    expect(east).toBeLessThan(75.4);
  });
});

describe("zoneAt", () => {
  it("picks the zone whose start is behind the point", () => {
    const starts = { "2": 56.2, "3": 84.2 };
    expect(zoneAt(0, starts)).toBe(1);
    expect(zoneAt(56.2, starts)).toBe(2);
    expect(zoneAt(90, starts)).toBe(3);
  });
});
