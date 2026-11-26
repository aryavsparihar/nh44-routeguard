// "How much rain tips this cell" (improves Round 1 feature 1, the live risk
// map). For one H3 cell: the rain in 72 h at which its landslide score turns
// Medium, and High, worked backwards from the job's own rule:
//
//   score = min(1, exposure(zone) x trigger x slope factor)
//   trigger = (rain_72h - 10) / (80 - 10), clamped to 0-1
//   slope factor = min(slope / 35°, 1); unknown slope counts as 1
//
// (jobs/risk/triggers.py landslide, jobs/risk/scoring.py pick_hazards,
// jobs/risk/hexes.py slope_factor). Every number comes from
// lib/risk/config.json: our own starting values, not sourced figures.
// Landslides only; the other hazards have more than one input.
// Runs in the browser too: no server-only imports here.
import riskConfig from "@/lib/risk/config.json";
import { levelFor, type Level } from "./risk";

const C = riskConfig.triggers.landslide;
const FULL_SLOPE = riskConfig.slope.full_effect_deg;
export const RAIN_WINDOW_H = C.rain_window_h;
export const BURST = { mm: C.burst_mm_over, hours: C.burst_window_h };

export type Need = { mm: number } | null; // null: rain alone can't get there

export type Tipping = {
  medium: Need; // smallest whole mm in 72 h that makes it Medium (or more)
  high: Need; // smallest whole mm in 72 h that makes it High
  max: number; // the highest landslide score this cell can reach
  nowMm: number | null; // the 72 h rain the model used, when it says
};

function exposure(zone: number): number | null {
  const z = (riskConfig.exposure as unknown as Record<string, Record<string, number>>)[String(zone)];
  return z && typeof z.landslide === "number" ? z.landslide : null;
}

export function slopeFactor(slope: number | null): number {
  return slope === null ? 1 : Math.max(0, Math.min(slope / FULL_SLOPE, 1));
}

// The job's landslide score for a cell after `mm` of rain in 72 h, with no
// downpour of more than 30 mm in 24 h (that adds 0.2 and tips it sooner).
export function landslideScore(mm: number, cap: number): number {
  const trigger = Math.max(0, Math.min(1, (mm - C.rain_mm_zero) / (C.rain_mm_full - C.rain_mm_zero)));
  return Math.min(1, cap * trigger);
}

const reaches = (want: Level, score: number) => (want === "high" ? levelFor(score) === "high" : levelFor(score) !== "low");

// The smallest whole mm that reaches the level: worked out backwards, then
// checked forwards so rounding can't move it by a millimetre.
function need(want: Level, cap: number): Need {
  if (!reaches(want, landslideScore(C.rain_mm_full, cap))) return null;
  const threshold = want === "high" ? riskConfig.levels.high_above : riskConfig.levels.medium_from;
  let mm = Math.max(0, Math.ceil(C.rain_mm_zero + (C.rain_mm_full - C.rain_mm_zero) * (threshold / cap)));
  while (!reaches(want, landslideScore(mm, cap))) mm += 1;
  while (mm > 0 && reaches(want, landslideScore(mm - 1, cap))) mm -= 1;
  return { mm };
}

// null when the cell has no zone (no exposure to work from).
export function tippingPoint(cell: {
  zone: number | null;
  slope: number | null;
  reasonCode: string | null;
  reasonParams: Record<string, unknown> | null;
}): Tipping | null {
  const e = cell.zone === null ? null : exposure(cell.zone);
  if (e === null) return null;
  const cap = Math.min(1, e * slopeFactor(cell.slope));
  // The reason only carries the 72 h rain when landslide is its top hazard.
  const mm = cell.reasonParams?.mm;
  const nowMm = cell.reasonCode?.startsWith("landslide") && typeof mm === "number" ? mm : null;
  return { medium: need("medium", cap), high: need("high", cap), max: cap, nowMm };
}
