import "server-only";
import type { Db } from "@/src/server/db";
import { HAZARDS, type Hazard, type Horizon, type Level, type RiskRow } from "@/src/shared/risk";
import { latestRunRows, type RunRow } from "./risk.repository";

// Risk scores change once an hour, and every visitor reads the same rows
// ("compute once, read many"). Each server instance keeps the newest run in
// memory for 60 seconds, so a burst of visitors costs one database query a
// minute per instance (BUILD_PROMPT section 17). Nothing user-specific is
// cached here.
export const RISK_CACHE_MS = 60_000;

export type LatestRun = {
  runAt: Date | null;
  modelVersion: string | null;
  rows: RiskRow[];
};

let cache: { at: number; run: LatestRun } | null = null;

export function clearRiskCache(): void {
  cache = null;
}

export async function getLatestRun(db: () => Promise<Db>, now: number = Date.now()): Promise<LatestRun> {
  if (cache && now - cache.at < RISK_CACHE_MS) return cache.run;
  const rows = await latestRunRows(await db());
  const run: LatestRun = {
    runAt: rows[0]?.run_at ?? null,
    modelVersion: rows[0]?.model_version ?? null,
    rows: rows.map(toRiskRow),
  };
  cache = { at: now, run };
  return run;
}

const n = (value: number | null | undefined) => Number(value ?? 0);

export function toRiskRow(row: RunRow): RiskRow {
  const hazards = Object.fromEntries(HAZARDS.map((h) => [h, n(row[h])])) as Record<Hazard, number>;
  return {
    zone_id: row.zone_id ?? 0,
    horizon_hours: (row.horizon_hours ?? 0) as Horizon,
    overall: n(row.overall),
    risk_low: n(row.risk_low),
    risk_high: n(row.risk_high),
    level: (row.level ?? "low") as Level,
    top_hazard: (row.top_hazard ?? null) as Hazard | null,
    confidence: row.confidence ?? "low",
    hazards,
    reason: row.reason ?? "",
    reason_code: row.reason_code ?? null,
    reason_params: (row.reason_params as Record<string, unknown> | null) ?? null,
  };
}

// Strong ETag: the run time is the version of the data. The URL (horizon,
// zone) is part of the cache key anyway, so one ETag per run is enough.
export function riskEtag(runAt: Date): string {
  return `"risk-${runAt.getTime()}"`;
}

// Matches If-None-Match against our ETag (a list, weak or strong, or *).
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  return ifNoneMatch
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .includes(etag);
}

// Data changes hourly: browsers reuse it for a minute, shared caches for
// five, and may serve a stale copy while they fetch a new one for up to the
// rest of the hour (section 17).
export const RISK_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=3300";
