// GET  /api/v1/shipments?status=&limit=&cursor=: the shipments on your board,
//      newest first. RLS decides which: an agent sees their own, a driver the
//      ones assigned to them, a grower or trader the lots they saved, an admin
//      all. Paged with next_cursor.
// POST /api/v1/shipments: save a lot (grower, trader) or a truck on your
//      board (agent). The advice at that moment (SEND, HOLD, RAIL, DIVERT) is
//      stored with it. Agents may set driver_id to one of their own drivers.
//        201  Location: /api/v1/shipments/{id}
//        409  this truck already has a shipment that isn't delivered
import { getDb } from "@/src/server/db";
import { readJson, readQuery } from "@/src/server/http/body";
import { ServiceUnavailableError, ValidationError } from "@/src/server/http/errors";
import { requireCaller } from "@/src/server/http/guards";
import { created, list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { getLatestRun } from "@/src/server/risk/risk.service";
import { getRoadStatus } from "@/src/server/road-status/road-status.service";
import { insertShipment, listShipments } from "@/src/server/shipments/shipments.repository";
import { createShipmentBody, daysSincePicking, shipmentsQuery } from "@/src/server/shipments/shipments.schemas";
import { decide, type Lot } from "@/src/shared/decide";

export const GET = withApi(
  { access: ["grower", "trader", "agent", "driver", "admin"] },
  async ({ req }) => {
    const q = readQuery(req, shipmentsQuery);
    const rows = await listShipments(await getDb(), { status: q.status, limit: q.limit, after: q.cursor });
    const more = rows.length > q.limit;
    const page = more ? rows.slice(0, q.limit) : rows;
    const last = page.at(-1);
    const next = more && last ? `${last.created_at.getTime()}_${last.id}` : null;
    return list(page, { count: page.length, next_cursor: next });
  },
);

export const POST = withApi({ access: ["grower", "trader", "agent"] }, async ({ req, caller }) => {
  const { userId, role } = requireCaller(caller);
  const body = await readJson(req, createShipmentBody);
  const isAgent = role === "agent";
  if (!isAgent && body.driver_id) {
    throw new ValidationError([{ path: "driver_id", message: "Only an agent assigns a driver." }]);
  }

  const lot = {
    variety: body.variety,
    days_since_picking: daysSincePicking(body.harvest_date),
    tonnes: body.tonnes,
    destination: body.destination,
    truck_type: body.truck_type,
  } as Lot;
  const [run, road] = await Promise.all([getLatestRun(getDb), getDb().then(getRoadStatus)]).catch(() => {
    throw new ServiceUnavailableError("The risk scores can't be read right now. Try again soon.");
  });
  const advice = decide(lot, { rows: run.rows, run_at: run.runAt?.toISOString() ?? null }, road);

  const id = await insertShipment(await getDb(), {
    created_by: userId,
    agent_id: isAgent ? userId : null,
    driver_id: isAgent ? (body.driver_id ?? null) : null,
    truck_number: body.truck_number ?? null,
    variety: body.variety,
    tonnes: body.tonnes,
    harvest_date: body.harvest_date,
    cold_stored: body.cold_stored ?? false,
    truck_type: body.truck_type,
    origin: body.origin ?? null,
    destination: body.destination,
    advice,
    eta: body.eta ? new Date(body.eta) : null,
  });
  return created({ id, status: "planned", advice }, `/api/v1/shipments/${id}`);
});

const notSupported = notAllowed(["GET", "POST"]);
export { notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
