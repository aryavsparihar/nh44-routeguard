// GET /api/v1/admin/audit-log: who did which privileged thing, when and why
// (role changes, official updates, road status). Read-only: rows come only
// from the write_audit() and admin_set_role() database functions and can't
// be changed or deleted by anyone. Admin only.
import { getDb } from "@/src/server/db";
import { listAuditLog } from "@/src/server/audit-log/audit-log.repository";
import { auditLogQuery } from "@/src/server/audit-log/audit-log.schemas";
import { readQuery } from "@/src/server/http/body";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";

export const GET = withApi({ access: ["admin"] }, async ({ req }) => {
  const { limit, cursor, action } = readQuery(req, auditLogQuery);
  const rows = await listAuditLog(await getDb(), { limit, before: cursor, action });
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? String(page[page.length - 1].id) : null;
  return list(page, { count: page.length, next_cursor: next });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
