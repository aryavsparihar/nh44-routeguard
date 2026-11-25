// GET /api/v1/reports?zone=&status=: road reports on the map right now
// (unconfirmed or confirmed, not expired, not hidden). Public. No user ids.
import { z } from "zod";
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { ACTIVE_STATUSES, listActiveReports } from "@/src/server/reports/reports.repository";
import { zoneParam } from "@/src/server/schemas/zone-query";

const query = z.object({ zone: zoneParam.optional(), status: z.enum(ACTIVE_STATUSES).optional() }).strict();

export const GET = withApi({ access: "public" }, async ({ req }) => {
  const { zone, status } = readQuery(req, query);
  const rows = await listActiveReports(await getDb(), { zone, status });
  return list(rows, { count: rows.length, next_cursor: null }, {
    headers: { "Cache-Control": "public, max-age=30" },
  });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
