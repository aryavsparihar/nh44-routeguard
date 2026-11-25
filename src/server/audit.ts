import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "@/src/server/db";

// Writes one row to audit_log through the database function write_audit().
// Use it for every privileged action that doesn't already audit itself
// (role changes do, inside admin_set_role). The actor (who did it, and their
// role) is taken from the caller's token by the database, not passed in, so
// nobody can write an entry in someone else's name.
//
//   await writeAudit(db, {
//     action: "official_update.deleted",
//     targetType: "official_update",
//     targetId: id,
//     reason: body.reason,
//     requestId,
//   });
//
// When the action and its audit row must succeed or fail together, run
// auditSql() inside the same db.rls() transaction instead:
//
//   await db.rls(async (tx) => { ...; await tx.execute(auditSql(entry)); });
//
// Never put personal data (names, emails, phone numbers) in meta.
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type AuditEntry = {
  action: string; // "thing.verb", max 60 characters
  targetType?: string;
  targetId?: string;
  reason?: string;
  requestId?: string;
  meta?: { [key: string]: Json };
};

export function auditSql(entry: AuditEntry): SQL {
  const meta = entry.meta === undefined ? null : JSON.stringify(entry.meta);
  return sql`select public.write_audit(${entry.action}::text, ${entry.targetType ?? null}::text,
    ${entry.targetId ?? null}::text, ${entry.reason ?? null}::text, ${entry.requestId ?? null}::text,
    ${meta}::jsonb) as id`;
}

export async function writeAudit(db: Db, entry: AuditEntry): Promise<number> {
  const rows = await db.rls((tx) => tx.execute<{ id: string | number }>(auditSql(entry)));
  return Number(rows[0].id);
}
