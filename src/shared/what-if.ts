// "What would change the answer" (improves Round 1 feature 4, the dispatch
// advisor). Runs the same decide() again with nearby values of the inputs the
// user typed, and keeps only the changes that really flip the decision.
// Runs on the phone, works offline, and needs no API change.
// Runs in the browser too: no server-only imports here.
import { decide, type Decision, type Lot, type RoadStatus, type TruckType } from "./decide";
import type { RiskRow } from "./risk";

// The ranges decide() accepts (the same as POST /api/v1/advice and the form).
export const LOT_LIMITS = {
  days_since_picking: { min: 0, max: 120 },
  tonnes: { min: 0.1, max: 40 },
} as const;

// How far we look: up to a week either way. Further away is a different
// lot, not "nearly the same one".
export const MAX_DAYS_CHANGE = 7;
export const MAX_LINES = 2;

export type WhatIf =
  | { kind: "days"; delta: number; days: number; decision: Decision }
  | { kind: "truck"; truck_type: TruckType; decision: Decision };

// Days since picking that are still inside the accepted range, nearest first,
// fewer days before more days at the same distance.
export function nearbyDays(days: number): number[] {
  const out: number[] = [];
  for (let step = 1; step <= MAX_DAYS_CHANGE; step++) {
    for (const d of [days - step, days + step]) {
      if (Number.isInteger(d) && d >= LOT_LIMITS.days_since_picking.min && d <= LOT_LIMITS.days_since_picking.max) {
        out.push(d);
      }
    }
  }
  return out;
}

// At most two short lines. Tonnes is left out on purpose: in decide() it only
// changes the priority band, never the decision.
export function whatWouldChange(
  lot: Lot,
  risk: { rows: RiskRow[]; run_at: string | null },
  road: RoadStatus,
): WhatIf[] {
  const now = decide(lot, risk, road).decision;
  const out: WhatIf[] = [];

  // The smallest change in days since picking that gives a different answer.
  for (const days of nearbyDays(lot.days_since_picking)) {
    const decision = decide({ ...lot, days_since_picking: days }, risk, road).decision;
    if (decision !== now) {
      out.push({ kind: "days", delta: days - lot.days_since_picking, days, decision });
      break;
    }
  }

  // The other kind of truck.
  const other: TruckType = lot.truck_type === "heavy" ? "light" : "heavy";
  const withOther = decide({ ...lot, truck_type: other }, risk, road).decision;
  if (withOther !== now) out.push({ kind: "truck", truck_type: other, decision: withOther });

  return out.slice(0, MAX_LINES);
}
