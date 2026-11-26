// "Reports vs the model" (improves Round 1 features 1 and 5, the live risk map
// and road reports): confirmed road reports that sit on a map cell the weather
// model scores Low for that same hazard. The score is never changed here: the
// job already counts a confirmed report as raising the zone's confidence
// (jobs/risk/scoring.py, report_agrees). This only shows where the people on
// the road and the weather model disagree, so a reader can look twice and we
// can see where the model needs work.
// Runs in the browser too: no server-only imports here.
import type { PublicReport, RiskHex } from "./api-types";
import { centresOf, nearestCell } from "./cell-closures";
import { HAZARDS, levelFor, type Hazard } from "./risk";

// A report is on a cell when that cell's centre is the nearest one and is
// within 1 km. Res-8 cells are about 1 km across, so this is "this cell or
// the edge of it", and a report far off the road matches nothing.
export const GAP_MAX_KM = 1;

export type ModelGap = {
  id: string; // the H3 cell
  zone: number | null;
  hazard: Hazard;
  score: number; // the model's score for this hazard on this cell
  reports: PublicReport[]; // newest first
};

const isHazard = (h: string): h is Hazard => HAZARDS.includes(h as Hazard);

// Call with the cells of the live "now" run and the reports still in force.
// Accident and "other" reports are left out: the weather model doesn't score
// them, so there is nothing to disagree with.
export function modelGaps(cells: readonly RiskHex[], reports: readonly PublicReport[]): ModelGap[] {
  const byId = new Map(cells.map((c) => [c.h3_index, c]));
  const centres = centresOf(cells.map((c) => ({ id: c.h3_index, boundary: c.boundary })));
  const out = new Map<string, ModelGap>();
  for (const r of reports) {
    if (r.status !== "confirmed" || !isHazard(r.hazard_type)) continue;
    const id = nearestCell(centres, r.lat, r.lng, GAP_MAX_KM);
    const cell = id ? byId.get(id) : undefined;
    if (!cell) continue;
    const score = cell.hazards[r.hazard_type];
    if (typeof score !== "number" || levelFor(score) !== "low") continue;
    const key = `${cell.h3_index}:${r.hazard_type}`;
    const gap = out.get(key) ?? { id: cell.h3_index, zone: cell.zone_id, hazard: r.hazard_type, score, reports: [] };
    gap.reports.push(r);
    out.set(key, gap);
  }
  const newest = (g: ModelGap) => g.reports[0].created_at;
  for (const g of out.values()) g.reports.sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Most reports first, then the newest.
  return [...out.values()].sort((a, b) => b.reports.length - a.reports.length || newest(b).localeCompare(newest(a)));
}
