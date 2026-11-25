import "server-only";
import { asc, count } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { zones } from "@/src/server/db/schema";

// How many corridor zones the database has (6 when seeded).
export async function countZones(db: Db): Promise<number> {
  const rows = await db.rls((tx) => tx.select({ n: count() }).from(zones));
  return rows[0]?.n ?? 0;
}

// The six NH-44 zones, Jammu first.
export async function listZones(db: Db) {
  return db.rls((tx) =>
    tx
      .select({
        id: zones.id,
        name: zones.name,
        from_place: zones.from_place,
        to_place: zones.to_place,
        length_km: zones.length_km,
        danger_km: zones.danger_km,
      })
      .from(zones)
      .orderBy(asc(zones.id)),
  );
}
