// Board marks for trucks heading into risk (improves Round 1 feature 6, the
// shipment board). Says which zone a truck is in and which comes next, and
// whether either is high in the next 12 hours. Advice only: it reads the same
// risk scores as the map and changes nothing.
// Runs in the browser too: no server-only imports here.
import type { Shipment } from "./api-types";
import { nearestOnRoad } from "./corridor";
import { ASSUMPTIONS, type Destination } from "./priority";
import type { RiskRow } from "./risk";

export const AHEAD_HOURS = 12;
// A last position further than this from NH-44 doesn't tell us the zone.
export const ON_ROAD_KM = 5;

// Not on the road any more: nothing to mark.
const OFF_ROAD = new Set<Shipment["status"]>(["delivered", "on_rail", "diverted"]);

export type TruckZones = { current: number | null; next: number | null };

// Trucks leave the valley (zone 6, Srinagar side) and head down to Jammu
// (zone 1); the line in data/nh44_line.json runs Jammu → Srinagar, so the
// next zone is the next lower zone on the route. A truck with no usable
// position hasn't been seen on the road: its next zone is where its route
// starts.
export function truckZones(s: Pick<Shipment, "status" | "destination" | "last_lat" | "last_lng">): TruckZones | null {
  if (OFF_ROAD.has(s.status)) return null;
  const route = ASSUMPTIONS.destinations[s.destination as Destination]?.zones;
  if (!route || route.length === 0) return null;
  const fromValley = [...route].sort((a, b) => b - a);

  if (s.last_lat !== null && s.last_lng !== null) {
    const here = nearestOnRoad(s.last_lat, s.last_lng);
    if (here.offRoadKm <= ON_ROAD_KM) {
      const next = fromValley.find((z) => z < here.zone) ?? null;
      return { current: here.zone, next };
    }
  }
  return { current: null, next: fromValley[0] };
}

export type TruckRisk =
  | { kind: "high"; zone: number; hours: number; which: "current" | "next" }
  | { kind: "clear" }
  | { kind: "unknown" };

// High now or in the next 12 h in the current zone, else the next one.
// "unknown" when the scores for those zones are missing: no mark is shown,
// because we can't say either way.
export function truckRisk(zones: TruckZones | null, rows: readonly RiskRow[]): TruckRisk {
  if (!zones) return { kind: "clear" };
  const ahead = rows.filter((r) => r.horizon_hours <= AHEAD_HOURS);
  let missing = false;
  for (const which of ["current", "next"] as const) {
    const zone = zones[which];
    if (zone === null) continue;
    const forZone = ahead.filter((r) => r.zone_id === zone).sort((a, b) => a.horizon_hours - b.horizon_hours);
    if (forZone.length === 0) {
      missing = true;
      continue;
    }
    const high = forZone.find((r) => r.level === "high");
    if (high) return { kind: "high", zone, hours: high.horizon_hours, which };
  }
  return missing ? { kind: "unknown" } : { kind: "clear" };
}
