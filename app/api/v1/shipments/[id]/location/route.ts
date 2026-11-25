// POST /api/v1/shipments/{id}/location: the assigned driver shares where the
// truck is. Needs location sharing turned on (PATCH /api/v1/me). Stored
// rounded to 2 decimals (about 1 km), so the agent sees the stretch of road,
// not an exact spot. { lat, lng } → 200 { last_seen_at }.
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { NotFoundError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { sendLocation } from "@/src/server/shipments/shipments.repository";
import { locationBody, shipmentId } from "@/src/server/shipments/shipments.schemas";

export const POST = withApi<{ id: string }>({ access: ["driver"] }, async ({ req, params }) => {
  if (!shipmentId.safeParse(params.id).success) throw new NotFoundError("No shipment with this id.");
  const at = await readJson(req, locationBody);
  const lastSeenAt = await sendLocation(await getDb(), params.id, at);
  return ok({ last_seen_at: lastSeenAt });
});

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
