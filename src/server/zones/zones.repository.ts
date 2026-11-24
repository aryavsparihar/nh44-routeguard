import "server-only";
import { count } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { zones } from "@/src/server/db/schema";

// How many corridor zones the database has (6 when seeded).
export async function countZones(db: Db): Promise<number> {
  const rows = await db.rls((tx) => tx.select({ n: count() }).from(zones));
  return rows[0]?.n ?? 0;
}
