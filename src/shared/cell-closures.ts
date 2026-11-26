// Past closures near each map cell (improves Round 1 feature 1, the live risk
// map): tapping a hexagon also lists the verified closures recorded there.
// Each closure goes to the one corridor cell whose centre is nearest to where
// its source puts it, if that is within MAX_KM. Sources name a place (often a
// village centre), not the exact spot, so the card says "near this cell".
// Runs in the browser too: no server-only imports here.
import type { PastClosure } from "./api-types";

export const MAX_KM = 2;

type Cell = { id: string; boundary: [number, number][] }; // [lng, lat], as the map draws it

const rad = (d: number) => (d * Math.PI) / 180;
function km(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// The centre of a cell: the mean of its corners (the ring repeats the first).
export function cellCentre(boundary: [number, number][]): { lat: number; lng: number } {
  const ring = boundary.length > 1 && boundary[0][0] === boundary.at(-1)![0] && boundary[0][1] === boundary.at(-1)![1] ? boundary.slice(0, -1) : boundary;
  const lng = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  return { lat, lng };
}

// cell id → its closures, newest first.
export function closuresByCell(cells: readonly Cell[], closures: readonly PastClosure[]): Map<string, PastClosure[]> {
  const centres = cells.map((c) => ({ id: c.id, ...cellCentre(c.boundary) }));
  const out = new Map<string, PastClosure[]>();
  for (const closure of closures) {
    if (closure.lat === null || closure.lng === null) continue;
    let best: { id: string; d: number } | null = null;
    for (const c of centres) {
      const d = km(closure.lat, closure.lng, c.lat, c.lng);
      if (!best || d < best.d) best = { id: c.id, d };
    }
    if (best && best.d <= MAX_KM) out.set(best.id, [...(out.get(best.id) ?? []), closure]);
  }
  for (const list of out.values()) list.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}
