// GET   /api/v1/shipments/{id}: one shipment, if it is on your board (else 404).
// PATCH /api/v1/shipments/{id}: the owner agent changes status, driver_id
//       (one of their own drivers, or null) or eta (or null).
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { NotFoundError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { getShipment, updateShipment } from "@/src/server/shipments/shipments.repository";
import { patchShipmentBody, shipmentId } from "@/src/server/shipments/shipments.schemas";

function checkId(id: string) {
  if (!shipmentId.safeParse(id).success) throw new NotFoundError("No shipment with this id.");
}

export const GET = withApi<{ id: string }>(
  { access: ["grower", "trader", "agent", "driver", "admin"] },
  async ({ params }) => {
    checkId(params.id);
    const row = await getShipment(await getDb(), params.id);
    if (!row) throw new NotFoundError("No shipment with this id on your board.");
    return ok(row);
  },
);

export const PATCH = withApi<{ id: string }>({ access: ["agent"] }, async ({ req, params }) => {
  checkId(params.id);
  const body = await readJson(req, patchShipmentBody);
  const db = await getDb();
  await updateShipment(db, params.id, {
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.driver_id !== undefined ? { driver_id: body.driver_id } : {}),
    ...(body.eta !== undefined ? { eta: body.eta === null ? null : new Date(body.eta) } : {}),
  });
  const row = await getShipment(db, params.id);
  if (!row) throw new NotFoundError("No shipment with this id on your board.");
  return ok(row);
});

const notSupported = notAllowed(["GET", "PATCH"]);
export { notSupported as POST, notSupported as PUT, notSupported as DELETE };
