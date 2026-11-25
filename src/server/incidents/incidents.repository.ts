import "server-only";
import { and, desc, eq, isNotNull, lt, or, type SQL } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { incidents } from "@/src/server/db/schema";

// Past closures that a person checked against their sources (verified_by is
// set; data/incidents.csv, docs/backtest.md). Newest first. Unverified leads
// never leave the database.
export async function listVerifiedIncidents(
  db: Db,
  opts: { zone?: number; limit: number; after?: { date: string; id: number } },
) {
  const where: SQL[] = [isNotNull(incidents.verified_by)];
  if (opts.zone !== undefined) where.push(eq(incidents.zone_id, opts.zone));
  if (opts.after) {
    const { date, id } = opts.after;
    where.push(or(lt(incidents.date, date), and(eq(incidents.date, date), lt(incidents.id, id)))!);
  }
  return db.rls((tx) =>
    tx
      .select({
        id: incidents.id,
        date: incidents.date,
        end_date: incidents.event_end_date,
        zone_id: incidents.zone_id,
        place: incidents.place,
        hazard_type: incidents.hazard_type,
        hours_closed: incidents.hours_closed,
        vehicles_stranded: incidents.vehicles_stranded,
        source_url: incidents.source_url,
        source_publisher: incidents.source_publisher,
        confidence: incidents.confidence,
      })
      .from(incidents)
      .where(and(...where))
      .orderBy(desc(incidents.date), desc(incidents.id))
      .limit(opts.limit + 1),
  );
}
