// The NH-44 road line (data/nh44_line.json, from OpenStreetMap via OSRM),
// cut into the six zones at the km where each zone starts. The map colours
// each piece by that zone's risk. Pure, so it runs on the server at render
// time and the browser only gets the result.
import line from "@/data/nh44_line.json";

export type LngLat = [number, number];
export type CorridorSegment = { zone: number; coords: LngLat[] };

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

function km(a: [number, number], b: [number, number]): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const h =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

// zone_starts_km: {"2": 56.2, ...}; zone 1 starts at 0.
export function zoneAt(kmAlong: number, starts: Record<string, number>): number {
  let zone = 1;
  for (const [z, from] of Object.entries(starts)) {
    if (kmAlong >= from && Number(z) > zone) zone = Number(z);
  }
  return zone;
}

// Every `keepEvery`-th point is kept (plus zone edges), which is plenty at
// the zoom the corridor is shown.
export function corridorSegments(keepEvery = 2): CorridorSegment[] {
  const points = line.points as [number, number][];
  const starts = line.zone_starts_km as Record<string, number>;
  const segments: CorridorSegment[] = [];
  let along = 0;
  let current: CorridorSegment | null = null;

  points.forEach((point, i) => {
    if (i > 0) along += km(points[i - 1], point);
    const zone = zoneAt(along, starts);
    const lngLat: LngLat = [point[1], point[0]];
    if (!current || current.zone !== zone) {
      // The point where the zone changes ends one piece and starts the
      // next, so the line has no gap.
      current?.coords.push(lngLat);
      current = { zone, coords: [lngLat] };
      segments.push(current);
      return;
    }
    const last = i === points.length - 1;
    if (last || i % keepEvery === 0) current.coords.push(lngLat);
  });
  return segments;
}

// [[west, south], [east, north]] around the whole line, for fitting the map.
export function corridorBounds(segments: CorridorSegment[]): [LngLat, LngLat] {
  const all = segments.flatMap((s) => s.coords);
  const lngs = all.map((c) => c[0]);
  const lats = all.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
