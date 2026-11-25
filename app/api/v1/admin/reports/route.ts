// GET /api/v1/admin/reports?status=&limit=&cursor=: every report, hidden
// ones too, with its flag count, for the moderation page. Admin only.
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { listReportsForAdmin } from "@/src/server/reports/reports.repository";
import { adminReportsQuery } from "@/src/server/reports/reports.schemas";

export const GET = withApi({ access: ["admin"] }, async ({ req }) => {
  const { status, limit, cursor } = readQuery(req, adminReportsQuery);
  const rows = await listReportsForAdmin(await getDb(), { status, limit, after: cursor });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const next = rows.length > limit && last ? `${last.created_at.getTime()}_${last.id}` : null;
  return list(page, { count: page.length, next_cursor: next });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
