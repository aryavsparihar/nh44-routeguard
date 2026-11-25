import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { boolean, date, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Db } from "@/src/server/db";
import { shipments, shipmentStatus, truckType, users } from "@/src/server/db/schema";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/src/server/http/errors";
import type { ShipmentStatus } from "./shipments.schemas";

// Shipments, read and written as the caller (getDb().rls()). RLS shows each
// person only the shipments they are on: the owner agent, the grower or
// trader who saved it, the assigned driver; admins see all.

const createdMs = sql`date_trunc('milliseconds', ${shipments.created_at})`;

const columns = {
  id: shipments.id,
  agent_id: shipments.agent_id,
  created_by: shipments.created_by,
  driver_id: shipments.driver_id,
  // The driver's name: RLS only lets an agent read their own drivers (and a
  // driver their own row), so other people get null here.
  driver_name: users.display_name,
  truck_number: shipments.truck_number,
  truck_type: shipments.truck_type,
  variety: shipments.variety,
  tonnes: shipments.tonnes,
  harvest_date: shipments.harvest_date,
  cold_stored: shipments.cold_stored,
  origin: shipments.origin,
  destination: shipments.destination,
  status: shipments.status,
  advice: shipments.advice,
  eta: shipments.eta,
  last_seen_at: shipments.last_seen_at,
  last_lat: sql<number | null>`extensions.st_y(${shipments.last_location}::extensions.geometry)`.mapWith(Number),
  last_lng: sql<number | null>`extensions.st_x(${shipments.last_location}::extensions.geometry)`.mapWith(Number),
  is_demo: shipments.is_demo,
  created_at: shipments.created_at,
  updated_at: shipments.updated_at,
};

export type ShipmentRow = Awaited<ReturnType<typeof listShipments>>[number];

export async function listShipments(
  db: Db,
  opts: { status?: ShipmentStatus; limit: number; after?: { createdAt: Date; id: string } },
) {
  const where: SQL[] = [];
  if (opts.status) where.push(eq(shipments.status, opts.status));
  if (opts.after) {
    where.push(
      sql`(${createdMs}, ${shipments.id}) < (${opts.after.createdAt.toISOString()}::timestamptz, ${opts.after.id}::uuid)`,
    );
  }
  return db.rls((tx) =>
    tx
      .select(columns)
      .from(shipments)
      .leftJoin(users, eq(users.id, shipments.driver_id))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(createdMs), desc(shipments.id))
      .limit(opts.limit + 1),
  );
}

export async function getShipment(db: Db, id: string) {
  const rows = await db.rls((tx) =>
    tx
      .select(columns)
      .from(shipments)
      .leftJoin(users, eq(users.id, shipments.driver_id))
      .where(eq(shipments.id, id))
      .limit(1),
  );
  return rows[0] ?? null;
}

// A user token may insert only these columns (grants in
// 20261125180000_shipments_fleet.sql). Drizzle names every column of a table
// in an INSERT, so inserts go through this narrower view of the same table.
const shipmentInsert = pgTable("shipments", {
  id: uuid().primaryKey(),
  created_by: text(),
  agent_id: text(),
  driver_id: text(),
  truck_number: text(),
  variety: text(),
  tonnes: numeric({ precision: 6, scale: 2, mode: "number" }),
  harvest_date: date({ mode: "string" }),
  cold_stored: boolean(),
  truck_type: truckType(),
  origin: text(),
  destination: text(),
  status: shipmentStatus(),
  advice: jsonb(),
  eta: timestamp({ withTimezone: true, mode: "date" }),
});

export type NewShipment = {
  created_by: string;
  agent_id: string | null;
  driver_id: string | null;
  truck_number: string | null;
  variety: string;
  tonnes: number;
  harvest_date: string;
  cold_stored: boolean;
  truck_type: "light" | "heavy";
  origin: string | null;
  destination: string;
  advice: Record<string, unknown>;
  eta: Date | null;
};

function mapShipmentError(err: unknown): never {
  if (err instanceof DbError) {
    if (err.code === "23505") {
      throw new ConflictError("This truck already has an active shipment. Mark that one delivered first.");
    }
    if (err.code === "23514") {
      throw new ValidationError([{ path: "driver_id", message: "Not a driver in your fleet." }]);
    }
    if (err.code === "23503") {
      throw new ConflictError("Your account has no RouteGuard profile yet. Finish onboarding first.");
    }
    if (err.code === "42501") throw new ForbiddenError("You can't change this shipment.");
  }
  throw err;
}

export async function insertShipment(db: Db, row: NewShipment): Promise<string> {
  try {
    const [created] = await db.rls((tx) =>
      tx
        .insert(shipmentInsert)
        .values({ ...row, id: sql`gen_random_uuid()`, status: "planned" })
        .returning({ id: shipmentInsert.id }),
    );
    return created.id;
  } catch (err) {
    mapShipmentError(err);
  }
}

export async function updateShipment(
  db: Db,
  id: string,
  patch: { status?: ShipmentStatus; driver_id?: string | null; eta?: Date | null },
): Promise<void> {
  try {
    const rows = await db.rls((tx) =>
      tx.update(shipments).set(patch).where(eq(shipments.id, id)).returning({ id: shipments.id }),
    );
    // RLS: only the owner agent's update touches a row; for anyone else it
    // runs and changes nothing.
    if (rows.length === 0) throw new NotFoundError("No shipment with this id on your board.");
  } catch (err) {
    mapShipmentError(err);
  }
}

export async function sendLocation(db: Db, id: string, at: { lat: number; lng: number }): Promise<Date> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ last_seen_at: string }>(
        sql`select * from private.shipment_location(${id}::uuid, ${at.lat}::double precision, ${at.lng}::double precision)`,
      ),
    );
    return new Date(rows[0].last_seen_at);
  } catch (err) {
    if (err instanceof DbError) {
      if (err.code === "P0002") throw new NotFoundError("No shipment with this id is assigned to you.");
      if (err.code === "55000") {
        throw new ConflictError("Turn on location sharing in your account first, or this shipment is delivered.");
      }
      if (err.code === "42501") throw new ForbiddenError("Only the assigned driver sends a location.");
    }
    throw err;
  }
}
