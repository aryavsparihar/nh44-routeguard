import "server-only";
import { and, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { auditSql } from "@/src/server/audit";
import type { Db } from "@/src/server/db";
import { publicReports, reports } from "@/src/server/db/schema";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, ForbiddenError, NotFoundError } from "@/src/server/http/errors";
import { enqueueSql } from "@/src/server/jobs/enqueue";
import type { JobName } from "@/src/server/jobs/jobs.schemas";
import { ACTIVE_STATUSES, type ActiveStatus, type ModerateInput } from "./reports.schemas";
import { REPORT_RULES_JSON } from "./rules";

export { ACTIVE_STATUSES, type ActiveStatus };

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
        has_photo: publicReports.has_photo,
      })
      .from(publicReports)
      .where(and(...where))
      .orderBy(desc(publicReports.created_at))
      .limit(100),
  );
}

// ---------------------------------------------------------------------------
// Writing (B2). The trust rules run in the database functions of migration
// 20261125160000_reports_write.sql, as the caller; these wrappers only pass
// values in (bound parameters) and turn database refusals into API errors.
// ---------------------------------------------------------------------------

export type SubmitOutcome = "created" | "repeat" | "merged";
export type SubmitResult = { id: string; status: string; outcome: SubmitOutcome };

function mapReportError(err: unknown, forbidden: string): never {
  if (err instanceof DbError) {
    if (err.code === "42501") throw new ForbiddenError(forbidden);
    if (err.code === "23503") {
      throw new ConflictError("Your account has no RouteGuard profile yet. Finish onboarding first.");
    }
    if (err.code === "23505") throw new ConflictError("This Idempotency-Key was already used for another report.");
    if (err.code === "P0002") throw new NotFoundError("No report with this id.");
    if (err.code === "55000") throw new ConflictError("This report is no longer on the map.");
  }
  throw err;
}

// Which job a report write puts on the queue. A new report always gets
// report.created. A new confirmation (or a merge, which counts as one) on a
// report that is now confirmed gets report.confirmed; the report may already
// have been confirmed before, so the worker treats it as "maybe new".
export function jobAfterSubmit(r: { status: string; outcome: SubmitOutcome }): JobName | null {
  if (r.outcome === "created") return "report.created";
  if (r.outcome === "merged" && r.status === "confirmed") return "report.confirmed";
  return null;
}

export function jobAfterConfirm(r: { status: string; outcome: "confirmed" | "repeat" }): boolean {
  return r.outcome === "confirmed" && r.status === "confirmed";
}

export async function submitReport(
  db: Db,
  r: {
    clientId: string;
    hazard: string;
    lat: number;
    lng: number;
    zoneId: number | null;
    note: string | null;
    photoPath: string | null;
  },
): Promise<SubmitResult> {
  try {
    const rows = await db.rls(async (tx) => {
      const out = await tx.execute<{ report_id: string; status: string; outcome: SubmitOutcome }>(
        sql`select * from private.submit_report(${r.clientId}::uuid, ${r.hazard}::public.hazard_type,
          ${r.lat}::double precision, ${r.lng}::double precision, ${r.zoneId}::smallint, ${r.note}::text,
          ${r.photoPath}::text, ${REPORT_RULES_JSON}::jsonb)`,
      );
      // The job is saved with the report or not at all (queue, section 17).
      const job = jobAfterSubmit(out[0]);
      if (job) await tx.execute(enqueueSql(job, { report_id: out[0].report_id }));
      return out;
    });
    return { id: rows[0].report_id, status: rows[0].status, outcome: rows[0].outcome };
  } catch (err) {
    mapReportError(err, "Your role can't post road reports.");
  }
}

export async function confirmReport(
  db: Db,
  id: string,
  at: { lat?: number; lng?: number },
  requestId: string,
): Promise<{ status: string; confirmations: number; outcome: "confirmed" | "repeat" }> {
  try {
    const rows = await db.rls(async (tx) => {
      const out = await tx.execute<{ status: string; confirmations: number; outcome: "confirmed" | "repeat" }>(
        sql`select * from private.confirm_report(${id}::uuid, ${at.lat ?? null}::double precision,
          ${at.lng ?? null}::double precision, ${REPORT_RULES_JSON}::jsonb, ${requestId}::text)`,
      );
      if (jobAfterConfirm(out[0])) await tx.execute(enqueueSql("report.confirmed", { report_id: id }));
      return out;
    });
    return { ...rows[0], confirmations: Number(rows[0].confirmations) };
  } catch (err) {
    mapReportError(err, "You can't confirm this report: it is your own, or your account isn't verified yet.");
  }
}

export async function flagReport(
  db: Db,
  id: string,
  reason: string,
): Promise<{ status: string; outcome: "flagged" | "repeat" }> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ status: string; outcome: "flagged" | "repeat" }>(
        sql`select * from private.flag_report(${id}::uuid, ${reason}::public.flag_reason, ${REPORT_RULES_JSON}::jsonb)`,
      ),
    );
    return rows[0];
  } catch (err) {
    mapReportError(err, "Sign in to flag reports.");
  }
}

// The storage path of a report's photo, if the report has one and isn't hidden.
export async function visiblePhotoPath(db: Db, id: string): Promise<string | null> {
  const rows = await db.rls((tx) =>
    tx.execute<{ path: string | null }>(sql`select private.report_photo_path(${id}::uuid) as path`),
  );
  return rows[0]?.path ?? null;
}

// ---------------------------------------------------------------------------
// Admin: every report, hidden ones too (RLS "Admins read all reports"), and
// moderation with a reason, audited in the same transaction.
// ---------------------------------------------------------------------------

const createdMs = sql`date_trunc('milliseconds', ${reports.created_at})`;

export async function listReportsForAdmin(
  db: Db,
  opts: { status?: string; limit: number; after?: { createdAt: Date; id: string } },
) {
  const where: SQL[] = [];
  if (opts.status) where.push(sql`${reports.status}::text = ${opts.status}`);
  if (opts.after) {
    where.push(
      sql`(${createdMs}, ${reports.id}) < (${opts.after.createdAt.toISOString()}::timestamptz, ${opts.after.id}::uuid)`,
    );
  }
  return db.rls((tx) =>
    tx
      .select({
        id: reports.id,
        source: reports.source,
        hazard_type: reports.hazard_type,
        lat: sql<number>`extensions.st_y(${reports.location}::extensions.geometry)`.mapWith(Number),
        lng: sql<number>`extensions.st_x(${reports.location}::extensions.geometry)`.mapWith(Number),
        zone_id: reports.zone_id,
        note: reports.note,
        status: reports.status,
        hidden_reason: reports.hidden_reason,
        confirmations: reports.confirmations,
        flags: sql<number>`(select count(*) from public.report_flags f where f.report_id = ${reports.id})`.mapWith(Number),
        has_photo: sql<boolean>`${reports.photo_path} is not null`,
        created_at: reports.created_at,
        expires_at: reports.expires_at,
        is_demo: reports.is_demo,
      })
      .from(reports)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(createdMs), desc(reports.id))
      .limit(opts.limit + 1),
  );
}

export type AdminReport = Awaited<ReturnType<typeof listReportsForAdmin>>[number];

// hide: off the map, with the reason. resolve: the road is clear again.
// restore: back to unconfirmed (after flags hid it by mistake).
const MODERATION = {
  hide: { from: ["unconfirmed", "confirmed", "expired", "resolved"], to: "hidden", action: "report.hidden" },
  resolve: { from: ["unconfirmed", "confirmed", "expired"], to: "resolved", action: "report.resolved" },
  restore: { from: ["hidden"], to: "unconfirmed", action: "report.restored" },
} as const;

export async function moderateReport(
  db: Db,
  id: string,
  input: ModerateInput,
  requestId: string,
): Promise<{ id: string; status: string }> {
  const rule = MODERATION[input.action];
  const row = await db.rls(async (tx) => {
    const [before] = await tx
      .select({ status: reports.status })
      .from(reports)
      .where(eq(reports.id, id))
      .for("update");
    if (!before) throw new NotFoundError("No report with this id.");
    if (!(rule.from as readonly string[]).includes(before.status)) {
      throw new ConflictError(`A ${before.status} report can't be changed this way.`);
    }
    const [updated] = await tx
      .update(reports)
      .set({
        status: rule.to,
        hidden_reason: rule.to === "hidden" ? input.reason : null,
      })
      .where(eq(reports.id, id))
      .returning({ id: reports.id, status: reports.status });
    await tx.execute(
      auditSql({
        action: rule.action,
        targetType: "report",
        targetId: id,
        reason: input.reason,
        requestId,
        meta: { from: before.status, to: rule.to },
      }),
    );
    return updated;
  });
  return row;
}
