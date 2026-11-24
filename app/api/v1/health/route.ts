// GET /api/v1/health: liveness. "The server is up." No database call, so it
// stays fast and works even when Supabase is down. Readiness (database
// reachable, data age) is /api/v1/health/ready.
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";

export const GET = withApi({ access: "public" }, async () => {
  return ok({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
