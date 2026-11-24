import "server-only";
import type { Json } from "@/lib/database.types";
import type { Db } from "@/src/server/db";
import { dbError } from "@/src/server/http/db-errors";

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
export type AuditEntry = {
  action: string; // "thing.verb", max 60 characters
  targetType?: string;
  targetId?: string;
  reason?: string;
  requestId?: string;
  meta?: { [key: string]: Json };
};

export async function writeAudit(db: Db, entry: AuditEntry): Promise<number> {
  const { data, error, status } = await db.rpc("write_audit", {
    p_action: entry.action,
    p_target_type: entry.targetType,
    p_target_id: entry.targetId,
    p_reason: entry.reason,
    p_request_id: entry.requestId,
    p_meta: entry.meta,
  });
  if (error) throw dbError(error, status);
  return data;
}
