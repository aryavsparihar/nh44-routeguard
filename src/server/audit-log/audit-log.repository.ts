import "server-only";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { auditLog } from "@/src/server/db/schema";

// Admins only (RLS "Admins read the audit log"). Nobody can change a row.
export async function listAuditLog(db: Db, opts: { limit: number; before?: number; action?: string }) {
  const where: SQL[] = [];
  if (opts.before !== undefined) where.push(lt(auditLog.id, opts.before));
  if (opts.action !== undefined) where.push(eq(auditLog.action, opts.action));
  return db.rls((tx) =>
    tx
      .select()
      .from(auditLog)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(auditLog.id))
      .limit(opts.limit + 1),
  );
}
