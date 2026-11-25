// GET /api/v1/incidents?zone=&limit=&cursor=: verified past closures on
// NH-44, newest first (data/incidents.csv after checking). Public.
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { listVerifiedIncidents } from "@/src/server/incidents/incidents.repository";
import { incidentCursor, incidentsQuery } from "@/src/server/incidents/incidents.schemas";

export const GET = withApi({ access: "public" }, async ({ req }) => {
  const query = readQuery(req, incidentsQuery);
  const rows = await listVerifiedIncidents(await getDb(), {
    zone: query.zone,
    limit: query.limit,
    after: query.cursor,
  });
  const page = rows.slice(0, query.limit);
  const more = rows.length > query.limit;
  return list(
    page,
    { count: page.length, next_cursor: more ? incidentCursor(page[page.length - 1]) : null },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
