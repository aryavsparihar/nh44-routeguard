// GET /api/v1/official-updates?zone=: police and TCU updates still in force,
// each with its source link. Public. Writing them is admin/police only
// (/api/v1/admin/official-updates).
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { listActiveUpdates } from "@/src/server/official-updates/official-updates.repository";
import { publicUpdatesQuery } from "@/src/server/official-updates/official-updates.schemas";

export const GET = withApi({ access: "public" }, async ({ req }) => {
  const { zone } = readQuery(req, publicUpdatesQuery);
  const rows = await listActiveUpdates(await getDb(), { zone });
  // Short cache: a closure should reach people within a minute.
  return list(rows, { count: rows.length, next_cursor: null }, {
    headers: { "Cache-Control": "public, max-age=30" },
  });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
