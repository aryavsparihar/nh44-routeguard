// GET /api/v1/zones: the six NH-44 zones, Jammu to Srinagar. Public.
// The names are the English place names; the screens translate the rest.
import { getDb } from "@/src/server/db";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { listZones } from "@/src/server/zones/zones.repository";

export const GET = withApi({ access: "public" }, async () => {
  const rows = await listZones(await getDb());
  return list(rows, { count: rows.length, next_cursor: null }, {
    // Zones change only with a migration.
    headers: { "Cache-Control": "public, max-age=3600" },
  });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
