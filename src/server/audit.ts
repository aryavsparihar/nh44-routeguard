import "server-only";
import { sql } from "drizzle-orm";
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

export async function writeAudit(db: Db, entry: AuditEntry): Promise<number> {
  const meta = entry.meta === undefined ? null : JSON.stringify(entry.meta);
  const rows = await db.rls((tx) =>
    tx.execute<{ id: string | number }>(
      sql`select public.write_audit(${entry.action}::text, ${entry.targetType ?? null}::text,
        ${entry.targetId ?? null}::text, ${entry.reason ?? null}::text, ${entry.requestId ?? null}::text,
        ${meta}::jsonb) as id`,
    ),
  );
  return Number(rows[0].id);
}
