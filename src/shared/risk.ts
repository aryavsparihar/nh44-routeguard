// Risk rows as the API sends them, and the small rules the screens share:
// levels from scores, and which zone counts as the "worst" one (L2).
// Runs in the browser too: no server-only imports here.
import riskConfig from "@/lib/risk/config.json";

export const HORIZONS = [0, 12, 24, 48] as const;
export type Horizon = (typeof HORIZONS)[number];

export const HAZARDS = ["landslide", "rockfall", "flash_flood", "snow_ice"] as const;
export type Hazard = (typeof HAZARDS)[number];

export const LEVELS = ["low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

export const ZONE_IDS = [1, 2, 3, 4, 5, 6] as const;

export const EXPOSURE_BANDS = ["low", "some", "high", "very_high"] as const;
export type ExposureBand = (typeof EXPOSURE_BANDS)[number];

// One zone at one horizon, from the newest risk job run.
export type RiskRow = {
  zone_id: number;
  horizon_hours: Horizon;
  overall: number;
  risk_low: number;
  risk_high: number;
  level: Level;
  top_hazard: Hazard | null;
  confidence: "low" | "medium" | "high";
  hazards: Record<Hazard, number>;
  reason: string; // English, written by the job; the fallback
  reason_code: string | null;
  reason_params: Record<string, unknown> | null;
};

export type RiskMeta = {
  count: number;
  next_cursor: null;
  run_at: string | null;
  model_version: string | null;
};

// The same cut-offs as the job (lib/risk/config.json, "levels"):
// below 0.30 low, up to 0.65 medium, above that high.
const { medium_from: MEDIUM_FROM, high_above: HIGH_ABOVE } = riskConfig.levels;

export function levelFor(score: number): Level {
  if (score > HIGH_ABOVE) return "high";
  if (score >= MEDIUM_FROM) return "medium";
  return "low";
}

// The score and level to show for a row: the overall one, or one hazard's
// when the hazard filter is on.
export function scoreFor(row: RiskRow, hazard: Hazard | null): { score: number; level: Level } {
  if (!hazard) return { score: row.overall, level: row.level };
  const score = row.hazards[hazard];
  return { score, level: levelFor(score) };
}

const LEVEL_RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };

function exposureRank(row: RiskRow): number {
  const band = row.reason_params?.exposure;
  const i = EXPOSURE_BANDS.indexOf(band as ExposureBand);
  return i; // -1 when the row has no exposure (no trigger)
}

export type Worst = { kind: "all_low" } | { kind: "worst"; row: RiskRow };

// The zone to put in the top card (L2). Nothing above low means "all zones
// low", never "worst: zone 1". Otherwise the highest level, then the highest
// score, then the zone more exposed to its hazard, then the lower zone number.
export function worstZone(rows: RiskRow[], hazard: Hazard | null = null): Worst {
  let worst: RiskRow | null = null;
  let worstScore = -1;
  let worstLevel: Level = "low";
  for (const row of rows) {
    const { score, level } = scoreFor(row, hazard);
    if (level === "low") continue;
    const better =
      worst === null ||
      LEVEL_RANK[level] > LEVEL_RANK[worstLevel] ||
      (level === worstLevel &&
        (score > worstScore ||
          (score === worstScore &&
            (exposureRank(row) > exposureRank(worst) ||
              (exposureRank(row) === exposureRank(worst) && row.zone_id < worst.zone_id)))));
    if (better) {
      worst = row;
      worstScore = score;
      worstLevel = level;
    }
  }
  return worst ? { kind: "worst", row: worst } : { kind: "all_low" };
}
