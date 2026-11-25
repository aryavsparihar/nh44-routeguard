// GET /api/v1/agents/drivers: the drivers in the agent's fleet, by name,
// with their verification level and whether they share their location.
import { getDb } from "@/src/server/db";
import { requireCaller } from "@/src/server/http/guards";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { listDrivers } from "@/src/server/fleet/fleet.repository";

export const GET = withApi({ access: ["agent"] }, async ({ caller }) => {
  const rows = await listDrivers(await getDb(), requireCaller(caller).userId);
  return list(rows, { count: rows.length, next_cursor: null });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
