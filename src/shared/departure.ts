// "When to leave" (improves Round 1 features 1, 2 and 4: the risk map, the
// 48-hour strip and the advisor's "hold"). Lays the road's H3 cells out in
// order from Srinagar to Jammu and asks, for a truck leaving at each time,
// how risky each cell is when the truck gets there.
//
// Honest by construction:
// - scores exist only now and at +12, +24 and +48 h, so a cell uses the
//   score of the nearest of those times (nothing in between is made up);
// - after +48 h there are no scores, and the cell counts as "no scores";
// - travel time is the starting value in config/advice-assumptions.json
//   (not sourced), and the screen says so.
// Runs in the browser too: no server-only imports here.
import { cellCentre } from "./cell-closures";
import { nearestOnRoad, roadLengthKm } from "./corridor";
import { ASSUMPTIONS } from "./priority";
import { HORIZONS, type Horizon, type Level } from "./risk";

export const DEPARTURES = [0, 6, 12, 24, 36] as const;
// Srinagar to Jammu: the Narwal (Jammu) route covers the whole corridor.
export const TRAVEL_HOURS: number = ASSUMPTIONS.destinations.narwal.road_hours;
export const LAST_HOUR = HORIZONS[HORIZONS.length - 1];

export type CellAlong = { id: string; zone: number | null; km: number }; // km from the Srinagar end

// The cells in road order, Srinagar first (the line itself runs Jammu →
// Srinagar, so the distance is counted back from its far end).
export function cellsAlongRoad(cells: readonly { id: string; zone?: number | null; boundary: [number, number][] }[]): CellAlong[] {
  const total = roadLengthKm();
  return cells
    .map((c) => {
      const { lat, lng } = cellCentre(c.boundary);
      return { id: c.id, zone: c.zone ?? null, km: Math.max(0, total - nearestOnRoad(lat, lng).kmAlong) };
    })
    .sort((a, b) => a.km - b.km || a.id.localeCompare(b.id));
}

// The forecast time nearest to `hours` from now (ties go to the earlier
// one), or null after the last one.
export function nearestHorizon(hours: number): Horizon | null {
  if (hours < 0 || hours > LAST_HOUR) return null;
  let best: Horizon = HORIZONS[0];
  for (const h of HORIZONS) if (Math.abs(h - hours) < Math.abs(best - hours)) best = h;
  return best;
}

export type LevelsByHorizon = Partial<Record<Horizon, ReadonlyMap<string, Level>>>;

// A cell's level when a truck that left at `depart` reaches it.
export function levelWhenThere(
  cell: CellAlong,
  depart: number,
  levels: LevelsByHorizon,
  roadKm: number,
  travelHours = TRAVEL_HOURS,
): Level | null {
  const at = depart + (roadKm > 0 ? (cell.km / roadKm) * travelHours : 0);
  const h = nearestHorizon(at);
  return h === null ? null : (levels[h]?.get(cell.id) ?? null);
}

export type DeparturePlan = {
  depart: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
  firstHighZone: number | null;
};

export function planDepartures(
  cells: readonly CellAlong[],
  levels: LevelsByHorizon,
  travelHours = TRAVEL_HOURS,
  departures: readonly number[] = DEPARTURES,
): DeparturePlan[] {
  const roadKm = cells.length ? cells[cells.length - 1].km : 0;
  return departures.map((depart) => {
    const plan: DeparturePlan = { depart, high: 0, medium: 0, low: 0, unknown: 0, firstHighZone: null };
    for (const cell of cells) {
      const level = levelWhenThere(cell, depart, levels, roadKm, travelHours);
      if (level === null) plan.unknown += 1;
      else plan[level] += 1;
      if (level === "high" && plan.firstHighZone === null) plan.firstHighZone = cell.zone;
    }
    return plan;
  });
}

// The departures with the fewest high cells, when that is fewer than leaving
// now; empty when no time is better (or nothing is high at all). Departures
// with cells that have no scores are left out: we can't vouch for them.
export function fewestHigh(plans: readonly DeparturePlan[]): DeparturePlan[] {
  const known = plans.filter((p) => p.unknown === 0);
  if (known.length === 0) return [];
  const min = Math.min(...known.map((p) => p.high));
  const now = plans[0];
  if (min === 0 && now.high === 0) return [];
  if (now.unknown === 0 && min >= now.high) return [];
  return known.filter((p) => p.high === min);
}
