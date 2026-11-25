// GET  /api/v1/admin/official-updates: every version, deleted ones too, for
//      the history on the admin page. Newest first, 50 a page.
// POST /api/v1/admin/official-updates: a new police/TCU update, with the
//      https link to where it was published. Audited.
// Admin and police only (BUILD_PROMPT sections 7 and 12). The public list is
// GET /api/v1/official-updates.
import { getDb } from "@/src/server/db";
import { readJson, readQuery } from "@/src/server/http/body";
import { requireCaller } from "@/src/server/http/guards";
import { created, list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { insertUpdate, listAllUpdates } from "@/src/server/official-updates/official-updates.repository";
import {
  adminUpdatesQuery,
  createUpdateBody,
  updateCursor,
} from "@/src/server/official-updates/official-updates.schemas";

export const GET = withApi({ access: ["police", "admin"] }, async ({ req }) => {
  const { limit, cursor } = readQuery(req, adminUpdatesQuery);
  const rows = await listAllUpdates(await getDb(), { limit, after: cursor });
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? updateCursor(page[page.length - 1]) : null;
  return list(page, { count: page.length, next_cursor: next });
});

export const POST = withApi({ access: ["police", "admin"] }, async ({ req, caller, requestId }) => {
  const input = await readJson(req, createUpdateBody);
  const row = await insertUpdate(await getDb(), requireCaller(caller).userId, input, { requestId });
  return created(row, `/api/v1/admin/official-updates/${row.id}`);
});

const notSupported = notAllowed(["GET", "POST"]);
export { notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
