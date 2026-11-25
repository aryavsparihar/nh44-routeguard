import "server-only";
import { and, asc, desc, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import { auditSql, type AuditEntry } from "@/src/server/audit";
import { enqueueSql } from "@/src/server/jobs/enqueue";
import type { Db } from "@/src/server/db";
import { officialUpdates } from "@/src/server/db/schema";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, NotFoundError, ValidationError } from "@/src/server/http/errors";
import { windowErrors, type CreateUpdateInput, type UpdatePatch } from "./official-updates.schemas";

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

// ---------------------------------------------------------------------------
// Admin and police. RLS lets only these two roles see deleted versions and
// write; the route checks the role first (two locks, docs/security.md).
// Who wrote each version is in the audit log, not in these rows.
// ---------------------------------------------------------------------------

const adminColumns = {
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
  supersedes_id: officialUpdates.supersedes_id,
  created_at: officialUpdates.created_at,
  deleted_at: officialUpdates.deleted_at,
  delete_reason: officialUpdates.delete_reason,
};

export type AdminUpdate = {
  [K in keyof typeof adminColumns]: (typeof officialUpdates.$inferSelect)[K];
};

// Postgres keeps microseconds; the cursor carries milliseconds. Sorting and
// comparing on the time cut to milliseconds keeps pages from skipping or
// repeating rows.
const createdMs = sql`date_trunc('milliseconds', ${officialUpdates.created_at})`;

export async function listAllUpdates(
  db: Db,
  opts: { limit: number; after?: { createdAt: Date; id: string } },
): Promise<AdminUpdate[]> {
  const where = opts.after
    ? sql`(${createdMs}, ${officialUpdates.id}) < (${opts.after.createdAt.toISOString()}::timestamptz, ${opts.after.id}::uuid)`
    : undefined;
  return db.rls((tx) =>
    tx
      .select(adminColumns)
      .from(officialUpdates)
      .where(where)
      .orderBy(desc(createdMs), desc(officialUpdates.id))
      .limit(opts.limit + 1),
  );
}

// A missing row, or one already replaced or deleted.
async function explainMissing(db: Db, id: string): Promise<never> {
  const rows = await db.rls((tx) =>
    tx.select({ id: officialUpdates.id }).from(officialUpdates).where(eq(officialUpdates.id, id)).limit(1),
  );
  if (rows.length === 0) throw new NotFoundError("No official update with this id.");
  throw new ConflictError("This version was already replaced or deleted. Change the newest version instead.");
}

// created_by must be a users row; police and admins get one when an admin
// grants the role, so this only fails for an account set up by hand.
function mapWriteError(err: unknown): never {
  if (err instanceof DbError && err.code === "23503") {
    throw new ConflictError("Your account has no RouteGuard profile yet. Finish onboarding first.");
  }
  if (err instanceof DbError && err.code === "23514") {
    throw new ValidationError([{ path: "", message: "A field breaks a database rule." }]);
  }
  throw err;
}

type Audit = Omit<AuditEntry, "targetId" | "targetType" | "action">;

// The new row and its audit entry are written in one transaction.
export async function insertUpdate(
  db: Db,
  createdBy: string,
  input: CreateUpdateInput,
  audit: Audit,
): Promise<AdminUpdate> {
  try {
    return await db.rls(async (tx) => {
      const [row] = await tx
        .insert(officialUpdates)
        .values({ ...input, created_by: createdBy })
        .returning(adminColumns);
      await tx.execute(
        auditSql({
          ...audit,
          action: "official_update.created",
          targetType: "official_update",
          targetId: row.id,
          meta: { version: 1, kind: row.kind, zone_id: row.zone_id },
        }),
      );
      await tx.execute(enqueueSql("official_update.created", { update_id: row.id }));
      return row;
    });
  } catch (err) {
    mapWriteError(err);
  }
}

// An edit: the old version is closed ("replaced by version n") and a new row
// carries the change, version + 1 and supersedes_id = the old id. Claiming
// the old row with "where deleted_at is null" makes two edits at once safe:
// the second one finds nothing and gets 409.
export async function replaceUpdate(
  db: Db,
  id: string,
  editedBy: string,
  patch: UpdatePatch,
  audit: Audit,
): Promise<AdminUpdate> {
  let row: AdminUpdate | null;
  try {
    row = await db.rls(async (tx) => {
      const [old] = await tx
        .update(officialUpdates)
        .set({
          deleted_at: sql`now()`,
          delete_reason: sql`'Replaced by version ' || (${officialUpdates.version} + 1)`,
        })
        .where(and(eq(officialUpdates.id, id), isNull(officialUpdates.deleted_at)))
        .returning(adminColumns);
      if (!old) return null;

      const merged = {
        zone_id: patch.zone_id !== undefined ? patch.zone_id : old.zone_id,
        kind: patch.kind ?? old.kind,
        title: patch.title ?? old.title,
        body: patch.body !== undefined ? patch.body : old.body,
        source_url: patch.source_url ?? old.source_url,
        source_name: patch.source_name ?? old.source_name,
        issued_at: patch.issued_at ?? old.issued_at,
        valid_until: patch.valid_until ?? old.valid_until,
      };
      const errors = windowErrors(merged.issued_at, merged.valid_until);
      if (errors.length > 0) throw new ValidationError(errors); // rolls back the close

      const [created] = await tx
        .insert(officialUpdates)
        .values({ ...merged, version: old.version + 1, supersedes_id: old.id, created_by: editedBy })
        .returning(adminColumns);
      await tx.execute(
        auditSql({
          ...audit,
          action: "official_update.edited",
          targetType: "official_update",
          targetId: created.id,
          meta: { version: created.version, supersedes_id: old.id, fields: Object.keys(patch) },
        }),
      );
      return created;
    });
  } catch (err) {
    mapWriteError(err);
  }
  return row ?? explainMissing(db, id);
}

// A soft delete with a reason. The row stays for the history.
export async function softDeleteUpdate(
  db: Db,
  id: string,
  reason: string,
  audit: Audit,
): Promise<AdminUpdate> {
  const row = await db.rls(async (tx) => {
    const [deleted] = await tx
      .update(officialUpdates)
      .set({ deleted_at: sql`now()`, delete_reason: reason })
      .where(and(eq(officialUpdates.id, id), isNull(officialUpdates.deleted_at)))
      .returning(adminColumns);
    if (!deleted) return null;
    await tx.execute(
      auditSql({
        ...audit,
        reason,
        action: "official_update.deleted",
        targetType: "official_update",
        targetId: deleted.id,
        meta: { version: deleted.version },
      }),
    );
    return deleted;
  });
  return row ?? explainMissing(db, id);
}
