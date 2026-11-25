import "server-only";
import { and, asc, desc, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { officialUpdates } from "@/src/server/db/schema";

// Police and TCU updates that are still in force: not deleted, not past
// valid_until. A zone filter also keeps updates for the whole road (no zone).
// Who wrote them (created_by) stays private.
export async function listActiveUpdates(db: Db, opts: { zone?: number }) {
  const where: SQL[] = [isNull(officialUpdates.deleted_at), gt(officialUpdates.valid_until, sql`now()`)];
  if (opts.zone !== undefined) {
    where.push(or(eq(officialUpdates.zone_id, opts.zone), isNull(officialUpdates.zone_id))!);
  }
  return db.rls((tx) =>
    tx
      .select({
        id: officialUpdates.id,
        zone_id: officialUpdates.zone_id,
        kind: officialUpdates.kind,
        title: officialUpdates.title,
        body: officialUpdates.body,
        source_url: officialUpdates.source_url,
        source_name: officialUpdates.source_name,
        issued_at: officialUpdates.issued_at,
        valid_until: officialUpdates.valid_until,
        version: officialUpdates.version,
      })
      .from(officialUpdates)
      .where(and(...where))
      .orderBy(desc(officialUpdates.issued_at), asc(officialUpdates.id))
      .limit(100),
  );
}
