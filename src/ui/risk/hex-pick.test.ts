import { cellToBoundary, cellToLatLng, gridDisk } from "h3-js";
import { describe, expect, it } from "vitest";
import { centre, containsPoint, distanceKm, metresPerPixel, pickHex, type HexShape } from "./hex-pick";

// Real resolution-8 cells: Ramban (data/corridor_hexes.csv) and its ring of
// neighbours, with outlines as the API sends them ([lng, lat], closed).
const RAMBAN = "883d308abdfffff";
const shape = (id: string): HexShape => ({ id, boundary: cellToBoundary(id, true) as [number, number][] });
const cells = gridDisk(RAMBAN, 1).map(shape);
const [lat, lng] = cellToLatLng(RAMBAN);

describe("pickHex", () => {
  it("picks the cell the point is inside", () => {
    expect(pickHex(cells, [lng, lat], 0)?.id).toBe(RAMBAN);
    for (const id of gridDisk(RAMBAN, 1)) {
      const [y, x] = cellToLatLng(id);
      expect(pickHex(cells, [x, y], 0)?.id).toBe(id);
    }
  });

  it("falls back to the nearest centre within maxKm", () => {
    const off: [number, number] = [lng + 0.05, lat]; // about 4.7 km east, outside all 7 cells
    expect(cells.some((c) => containsPoint(c.boundary, off))).toBe(false);
    const near = pickHex(cells, off, 10);
    const dists = cells.map((c) => distanceKm(centre(c.boundary), off));
    expect(distanceKm(centre(near!.boundary), off)).toBe(Math.min(...dists));
    expect(pickHex(cells, off, 1)).toBeNull(); // too far: a tap off the road
  });

  it("finds the cell centre from its outline", () => {
    const [x, y] = centre(shape(RAMBAN).boundary);
    expect(distanceKm([x, y], [lng, lat])).toBeLessThan(0.05);
  });
});

describe("metresPerPixel", () => {
  it("halves with each zoom step and shrinks with latitude", () => {
    expect(metresPerPixel(0, 0)).toBeCloseTo(78271.5, 0);
    expect(metresPerPixel(33, 12) / metresPerPixel(33, 13)).toBeCloseTo(2);
    expect(metresPerPixel(33, 12)).toBeLessThan(metresPerPixel(0, 12));
  });
});
