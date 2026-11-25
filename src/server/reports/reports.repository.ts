import "server-only";
import { and, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { publicReports } from "@/src/server/db/schema";

export const ACTIVE_STATUSES = ["unconfirmed", "confirmed"] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

// Road reports that are on the map right now: not hidden (the public_reports
// view already drops those), not expired, not resolved. The view has no user
// ids, and we don't add any.
export async function listActiveReports(db: Db, opts: { zone?: number; status?: ActiveStatus }) {
  const where: SQL[] = [
    inArray(publicReports.status, opts.status ? [opts.status] : [...ACTIVE_STATUSES]),
    gt(publicReports.expires_at, sql`now()`),
  ];
  if (opts.zone !== undefined) where.push(eq(publicReports.zone_id, opts.zone));
  return db.rls((tx) =>
    tx
      .select({
        id: publicReports.id,
        source: publicReports.source,
        hazard_type: publicReports.hazard_type,
        lat: sql<number>`extensions.st_y(${publicReports.location}::extensions.geometry)`.mapWith(Number),
        lng: sql<number>`extensions.st_x(${publicReports.location}::extensions.geometry)`.mapWith(Number),
        zone_id: publicReports.zone_id,
        note: publicReports.note,
        status: publicReports.status,
        confirmations: publicReports.confirmations,
        created_at: publicReports.created_at,
        expires_at: publicReports.expires_at,
        is_demo: publicReports.is_demo,
      })
      .from(publicReports)
      .where(and(...where))
      .orderBy(desc(publicReports.created_at))
      .limit(100),
  );
}
