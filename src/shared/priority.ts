// How urgent a lot is (L13): the share of its shelf life already used times
// the value of the load, shown as a band (high / medium / low) with every
// input next to it. All inputs come from config/advice-assumptions.json and
// are our own starting values, not sourced figures; the screen says so.
// Runs in the browser too: no server-only imports here.
import assumptions from "@/config/advice-assumptions.json";

export const ASSUMPTIONS = assumptions;
export const ASSUMPTIONS_VERSION = assumptions.version;

export type Variety = keyof typeof assumptions.varieties;
export type Destination = keyof typeof assumptions.destinations;
export const VARIETIES = Object.keys(assumptions.varieties) as Variety[];
export const DESTINATIONS = Object.keys(assumptions.destinations) as Destination[];

export type PriorityBand = "high" | "medium" | "low";

export type Priority = {
  band: PriorityBand;
  shelf_used: number; // 0..1
  value_lakh: number; // load value in lakh rupees (1 lakh = 100,000)
  shelf_days: number; // assumption
  price_rs_per_kg: number; // assumption
  score: number; // shelf_used x value_lakh, for sorting only
  assumptions_version: string;
};

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

export function priorityFor(lot: { variety: Variety; days_since_picking: number; tonnes: number }): Priority {
  const v = assumptions.varieties[lot.variety];
  const shelfUsed = Math.min(1, lot.days_since_picking / v.shelf_days);
  // tonnes x 1000 kg x Rs/kg, in lakh (100,000) rupees
  const valueLakh = (lot.tonnes * 1000 * v.price_rs_per_kg) / 100_000;
  const score = shelfUsed * valueLakh;
  const { high_from, medium_from } = assumptions.priority_bands;
  const band: PriorityBand = score >= high_from ? "high" : score >= medium_from ? "medium" : "low";
  return {
    band,
    shelf_used: round(shelfUsed, 2),
    value_lakh: round(valueLakh, 2),
    shelf_days: v.shelf_days,
    price_rs_per_kg: v.price_rs_per_kg,
    score: round(score, 2),
    assumptions_version: assumptions.version,
  };
}
