import type { LngLat } from "@/src/shared/corridor";

// The simple map (SimpleMap.tsx) draws the corridor as an SVG when MapLibre
// can't run: no WebGL (hardware acceleration off) or the base map's host
// blocked (Brave Shields, ad blockers). These helpers turn longitude and
// latitude into SVG units.
//
// The road is about 150 km long, so a flat projection is close enough: one
// degree of longitude is cos(latitude) of a degree of latitude. North is up.

export const SIMPLE_MAP_HEIGHT = 1000; // SVG units; the width follows the shape

export type Projector = {
  width: number;
  height: number;
  viewBox: string;
  point: (lng: number, lat: number) => [number, number];
};

// bounds: [[west, south], [east, north]]. pad: the share of the height kept
// clear on every side, so the line and labels don't touch the edge.
export function projector(bounds: [LngLat, LngLat], pad = 0.05): Projector {
  const [[west, south], [east, north]] = bounds;
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const spanX = Math.max((east - west) * k, 1e-9);
  const spanY = Math.max(north - south, 1e-9);
  const inner = SIMPLE_MAP_HEIGHT * (1 - 2 * pad);
  const scale = inner / Math.max(spanX, spanY);
  const margin = SIMPLE_MAP_HEIGHT * pad;
  const width = round(spanX * scale + 2 * margin);
  const height = round(spanY * scale + 2 * margin);
  return {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    point: (lng, lat) => [round(margin + (lng - west) * k * scale), round(margin + (north - lat) * scale)],
  };
}

// "M x y L x y ..." for a line through the points.
export function linePath(coords: [number, number][], p: Projector): string {
  return coords.map(([lng, lat], i) => `${i === 0 ? "M" : "L"}${p.point(lng, lat).join(" ")}`).join(" ");
}

// "x,y x,y ..." for an SVG polygon.
export function polygonPoints(ring: [number, number][], p: Projector): string {
  return ring.map(([lng, lat]) => p.point(lng, lat).join(",")).join(" ");
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
