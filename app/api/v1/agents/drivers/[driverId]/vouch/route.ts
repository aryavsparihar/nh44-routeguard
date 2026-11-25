// POST /api/v1/agents/drivers/{driverId}/vouch: the agent says they know this
// driver. Raises the driver to agent_vouched (their reports count for more)
// and writes it to the audit log. No body. → 200 { verification_level,
// outcome: "vouched" | "repeat" }. 404 if the driver isn't in this fleet.
import { getDb } from "@/src/server/db";
import { NotFoundError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { vouchDriver } from "@/src/server/fleet/fleet.repository";
import { userId } from "@/src/server/shipments/shipments.schemas";

export const POST = withApi<{ driverId: string }>(
  { access: ["agent"], rateLimit: "verification" },
  async ({ params, requestId }) => {
    if (!userId.safeParse(params.driverId).success) throw new NotFoundError("No driver with this id.");
    return ok(await vouchDriver(await getDb(), params.driverId, requestId));
  },
);

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
