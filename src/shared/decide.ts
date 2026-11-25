// The dispatch advice (L12): SEND, HOLD, RAIL or DIVERT for one lot of
// apples, from the newest risk scores on its route and the admin-set road
// and rail status. The same function runs on the server (POST
// /api/v1/advice) and on the phone when it is offline, so both give the same
// answer for the same inputs (decide.test.ts checks this).
//
// Rules from Round 1 (the Round 2 prototype's decide()), changed for L14:
// Mughal Road and the parcel train are only suggested when an admin has
// marked them open/running; unknown says "check with TCU / Northern Railway".
// It returns codes, not sentences; the screens translate them.
// Runs in the browser too: no server-only imports here.
import { ASSUMPTIONS, priorityFor, type Destination, type Priority, type Variety } from "./priority";
import type { Level, RiskRow } from "./risk";

export const RULES_VERSION = "advice-v1";

export type Decision = "SEND" | "HOLD" | "RAIL" | "DIVERT";
export type TruckType = "light" | "heavy";
export type RoadState = "open" | "closed" | "unknown";

export type Lot = {
  variety: Variety;
  days_since_picking: number; // 0..120
  tonnes: number; // 0.1..40
  destination: Destination;
  truck_type: TruckType;
};

// mughal_road: open = light trucks may use it now. rail_parcel: open = the
// Budgam–Delhi parcel train is running and taking bookings.
export type RoadStatus = { mughal_road: RoadState; rail_parcel: RoadState };

export type Advice = {
  decision: Decision;
  reason_code:
    | "send_low"
    | "hold_medium"
    | "divert_mughal"
    | "rail_high"
    | "divert_store_valley"
    | "divert_store";
  reason_params: Record<string, string | number>;
  delay_code: "none" | "hold" | "mughal" | "rail" | "store";
  delay_hours: number | null;
  notes: ("mughal_unknown" | "mughal_closed" | "rail_unknown" | "rail_closed" | "no_scores")[];
  worst: { zone: number; horizon: number; level: Level; overall: number } | null;
  high_zones: number[];
  priority: Priority;
  rules_version: string;
  risk_run_at: string | null;
};

const LEVEL_RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };

export function decide(
  lot: Lot,
  risk: { rows: RiskRow[]; run_at: string | null },
  road: RoadStatus,
): Advice {
  const dest = ASSUMPTIONS.destinations[lot.destination];
  const priority = priorityFor(lot);
  const get = (zone: number, h: number) =>
    risk.rows.find((r) => r.zone_id === zone && r.horizon_hours === h);

  // The worst zone on the route over the next 24 h: highest level, then
  // highest score, then the earlier zone and time.
  let worst: Advice["worst"] = null;
  for (const zone of dest.zones) {
    for (const h of [0, 12, 24]) {
      const r = get(zone, h);
      if (!r) continue;
      if (
        !worst ||
        LEVEL_RANK[r.level] > LEVEL_RANK[worst.level] ||
        (r.level === worst.level && r.overall > worst.overall)
      ) {
        worst = { zone, horizon: h, level: r.level, overall: r.overall };
      }
    }
  }
  // Zones still high a day and two days from now: the road is likely shut
  // for longer than the fruit can wait.
  const highZones = dest.zones.filter((z) => get(z, 24)?.level === "high" && get(z, 48)?.level === "high");

  const base = {
    worst,
    high_zones: highZones,
    priority,
    rules_version: RULES_VERSION,
    risk_run_at: risk.run_at,
  };
  const notes: Advice["notes"] = [];

  // No scores at all: we can't say it is safe. Hold and check again.
  if (!worst) {
    return {
      ...base,
      decision: "HOLD",
      reason_code: "hold_medium",
      reason_params: {},
      delay_code: "hold",
      delay_hours: ASSUMPTIONS.hold_hours,
      notes: ["no_scores"],
    };
  }

  const at = { zone: worst.zone, horizon: worst.horizon };

  if (worst.level === "low") {
    return {
      ...base,
      decision: "SEND",
      reason_code: "send_low",
      reason_params: { zones: dest.zones.length },
      delay_code: "none",
      delay_hours: 0,
      notes,
    };
  }

  if (worst.level === "medium") {
    if (lot.truck_type === "light" && !dest.valley) {
      if (road.mughal_road === "open") {
        return {
          ...base,
          decision: "DIVERT",
          reason_code: "divert_mughal",
          reason_params: at,
          delay_code: "mughal",
          delay_hours: null,
          notes,
        };
      }
      notes.push(road.mughal_road === "closed" ? "mughal_closed" : "mughal_unknown");
    }
    return {
      ...base,
      decision: "HOLD",
      reason_code: "hold_medium",
      reason_params: at,
      delay_code: "hold",
      delay_hours: ASSUMPTIONS.hold_hours,
      notes,
    };
  }

  // High.
  if (highZones.length > 0 && !dest.valley && priority.shelf_used >= ASSUMPTIONS.rail_when_shelf_used_from) {
    if (road.rail_parcel === "open") {
      return {
        ...base,
        decision: "RAIL",
        reason_code: "rail_high",
        reason_params: { zones: highZones.join(", "), pct: Math.round(priority.shelf_used * 100) },
        delay_code: "rail",
        delay_hours: null,
        notes,
      };
    }
    notes.push(road.rail_parcel === "closed" ? "rail_closed" : "rail_unknown");
  }
  return {
    ...base,
    decision: "DIVERT",
    reason_code: dest.valley ? "divert_store_valley" : "divert_store",
    reason_params: at,
    delay_code: "store",
    delay_hours: null,
    notes,
  };
}
