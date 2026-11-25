// GET /api/v1/road-status: Mughal Road (open to light trucks?) and the
// Budgam–Delhi parcel train (running?), as an admin last set them, with the
// source and the time. Public. The advisor reads it (L14).
import { getDb } from "@/src/server/db";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { listRoadStatus } from "@/src/server/road-status/road-status.repository";

export const GET = withApi({ access: "public" }, async () => {
  const rows = await listRoadStatus(await getDb());
  return list(rows, { count: rows.length, next_cursor: null }, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
