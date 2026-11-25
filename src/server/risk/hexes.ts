import "server-only";
import { cellToBoundary } from "h3-js";
import type { HexRow } from "./risk.repository";

export type HexFeature = {
  h3_index: string;
  zone_id: number | null;
  overall: number | null;
  hazards: { landslide: number; rockfall: number; flash_flood: number; snow_ice: number };
  level: "low" | "medium" | "high";
  top_hazard: string | null;
  confidence: string | null;
  // Why, as the job's English sentence and as a code + params the phone
  // turns into Hindi or Urdu (src/shared/reason.ts), like the zone rows.
  reason: string;
  reason_code: string | null;
  reason_params: Record<string, unknown> | null;
  slope_deg: number | null; // steepest centre-to-corner slope of the cell
  boundary: [number, number][]; // [lng, lat], closed ring
};

// The outline of each cell is worked out here, so the phone doesn't need
// the H3 library (hundreds of KB) just to draw the map.
export function withBoundaries(rows: HexRow[]): HexFeature[] {
  return rows
    .filter((r): r is HexRow & { h3_index: string } => !!r.h3_index)
    .map((r) => ({
      h3_index: r.h3_index,
      zone_id: r.zone_id,
      overall: r.overall,
      hazards: {
        landslide: r.landslide ?? 0,
        rockfall: r.rockfall ?? 0,
        flash_flood: r.flash_flood ?? 0,
        snow_ice: r.snow_ice ?? 0,
      },
      level: r.level as HexFeature["level"],
      top_hazard: r.top_hazard,
      confidence: r.confidence,
      reason: r.reason ?? "",
      reason_code: r.reason_code,
      reason_params: (r.reason_params as Record<string, unknown> | null) ?? null,
      slope_deg: r.slope_deg ?? null,
      boundary: cellToBoundary(r.h3_index, true).map(([lng, lat]) => [round(lng), round(lat)] as [number, number]),
    }));
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

// The ETag carries the run time, the horizon and the shape of a cell
// (HexFeature). Add 1 to HEX_FORMAT whenever a field is added, removed or
// changes meaning: otherwise a phone holding an older copy asks "changed?",
// gets 304 for the same run and keeps a copy without the new fields.
// 2: slope_deg and reason fields added (26 Nov 2026).
export const HEX_FORMAT = 2;
export function hexEtag(runAt: Date, horizon: number): string {
  return `"hex${HEX_FORMAT}-${runAt.getTime()}-${horizon}"`;
}

// One copy per run and horizon per server instance: hexes change hourly.
const cache = new Map<string, HexFeature[]>();
export function cachedHexes(runAt: string, horizon: number, make: () => Promise<HexFeature[]>) {
  const key = `${runAt}:${horizon}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return make().then((features) => {
    if (![...cache.keys()].every((k) => k.startsWith(`${runAt}:`))) cache.clear();
    cache.set(key, features);
    return features;
  });
}
