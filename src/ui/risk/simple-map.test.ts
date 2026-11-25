import { describe, expect, it } from "vitest";
import { linePath, polygonPoints, projector, SIMPLE_MAP_HEIGHT } from "./simple-map";

// Roughly the corridor: Jammu (south-west) to Srinagar (north).
const bounds: [[number, number], [number, number]] = [
  [74.8, 32.7],
  [75.3, 34.1],
];

describe("projector", () => {
  const p = projector(bounds, 0.05);

  it("keeps the padding on the long side and puts north at the top", () => {
    expect(p.height).toBe(SIMPLE_MAP_HEIGHT);
    expect(p.point(74.8, 34.1)).toEqual([50, 50]); // north-west corner
    expect(p.point(74.8, 32.7)).toEqual([50, 950]); // south-west corner
  });

  it("shrinks longitude by cos(latitude)", () => {
    const k = Math.cos((33.4 * Math.PI) / 180);
    const [east] = p.point(75.3, 34.1);
    expect(east).toBeCloseTo(50 + (0.5 * k * 900) / 1.4, 0);
    expect(p.width).toBeCloseTo(east + 50, 0);
    expect(p.viewBox).toBe(`0 0 ${p.width} ${p.height}`);
  });

  it("fits a wide box by its width", () => {
    const wide = projector(
      [
        [74, 33],
        [76, 33.1],
      ],
      0,
    );
    expect(wide.width).toBe(SIMPLE_MAP_HEIGHT);
    expect(wide.height).toBeLessThan(SIMPLE_MAP_HEIGHT);
  });

  it("doesn't divide by zero for a single point", () => {
    const dot = projector([
      [75, 33],
      [75, 33],
    ]);
    expect(dot.point(75, 33).every(Number.isFinite)).toBe(true);
  });
});

describe("paths", () => {
  const p = projector(bounds, 0.05);

  it("draws a line with M then L", () => {
    expect(
      linePath(
        [
          [74.8, 34.1],
          [74.8, 32.7],
        ],
        p,
      ),
    ).toBe("M50 50 L50 950");
  });

  it("lists polygon points as x,y pairs", () => {
    expect(
      polygonPoints(
        [
          [74.8, 34.1],
          [74.8, 32.7],
        ],
        p,
      ),
    ).toBe("50,50 50,950");
  });
});
