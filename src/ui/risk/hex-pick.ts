// Which H3 cell a tap on the map means. The outlines come from the API
// (GET /api/v1/risk/hexes), so the phone needs no H3 library.
//
// First the cell the tapped point is inside. A finger is wide and the
// cells are small (about 1 km across), so if the point is in none of them,
// the nearest cell centre within maxKm. Otherwise nothing (a tap off the
// road).

export type HexShape = { id: string; boundary: [number, number][] }; // [lng, lat], closed ring

// Ray casting. Fine in plain degrees at this size (cells about 1 km).
export function containsPoint(ring: [number, number][], [lng, lat]: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// The average of the corners (the ring repeats the first one at the end).
export function centre(ring: [number, number][]): [number, number] {
  const corners = ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
  const lng = corners.reduce((s, c) => s + c[0], 0) / corners.length;
  const lat = corners.reduce((s, c) => s + c[1], 0) / corners.length;
  return [lng, lat];
}

// Flat-earth distance in km: close enough for a few km.
export function distanceKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const k = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot((lng2 - lng1) * k, lat2 - lat1) * 111.32;
}

export function pickHex(hexes: HexShape[], point: [number, number], maxKm: number): HexShape | null {
  const hit = hexes.find((h) => containsPoint(h.boundary, point));
  if (hit) return hit;
  let best: HexShape | null = null;
  let bestKm = maxKm;
  for (const h of hexes) {
    const km = distanceKm(centre(h.boundary), point);
    if (km <= bestKm) {
      best = h;
      bestKm = km;
    }
  }
  return best;
}

// Ground metres one screen pixel covers at this latitude and zoom
// (MapLibre uses 512-pixel tiles).
export function metresPerPixel(lat: number, zoom: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}
