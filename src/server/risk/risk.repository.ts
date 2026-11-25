import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { latestRisk } from "@/src/server/db/schema";

// The newest risk job run for each zone (zone rows, not hexes) at one horizon.
export async function latestZoneRisk(db: Db, horizonHours: number) {
  return db.rls((tx) =>
    tx
      .select({
        run_at: latestRisk.run_at,
        zone_id: latestRisk.zone_id,
        zone_name: latestRisk.zone_name,
        overall: latestRisk.overall,
        risk_low: latestRisk.risk_low,
        risk_high: latestRisk.risk_high,
        level: latestRisk.level,
        top_hazard: latestRisk.top_hazard,
        confidence: latestRisk.confidence,
        reason: latestRisk.reason,
        model_version: latestRisk.model_version,
      })
      .from(latestRisk)
      .where(and(isNull(latestRisk.h3_index), eq(latestRisk.horizon_hours, horizonHours)))
      .orderBy(asc(latestRisk.zone_id)),
  );
}

export type ZoneRisk = Awaited<ReturnType<typeof latestZoneRisk>>[number];

// Every zone row (all horizons) of the newest run, for GET /api/v1/risk.
export async function latestRunRows(db: Db) {
  return db.rls((tx) =>
    tx
      .select({
        run_at: latestRisk.run_at,
        zone_id: latestRisk.zone_id,
        horizon_hours: latestRisk.horizon_hours,
        landslide: latestRisk.landslide,
        rockfall: latestRisk.rockfall,
        flash_flood: latestRisk.flash_flood,
        snow_ice: latestRisk.snow_ice,
        overall: latestRisk.overall,
        risk_low: latestRisk.risk_low,
        risk_high: latestRisk.risk_high,
        level: latestRisk.level,
        top_hazard: latestRisk.top_hazard,
        confidence: latestRisk.confidence,
        reason: latestRisk.reason,
        reason_code: latestRisk.reason_code,
        reason_params: latestRisk.reason_params,
        model_version: latestRisk.model_version,
      })
      .from(latestRisk)
      .where(isNull(latestRisk.h3_index))
      .orderBy(asc(latestRisk.horizon_hours), asc(latestRisk.zone_id)),
  );
}

export type RunRow = Awaited<ReturnType<typeof latestRunRows>>[number];
