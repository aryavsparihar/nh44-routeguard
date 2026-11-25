import "server-only";
import { asc } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { roadStatus } from "@/src/server/db/schema";

// Mughal Road and the parcel train, as an admin last set them. Who set it
// (updated_by) stays private.
export async function listRoadStatus(db: Db) {
  return db.rls((tx) =>
    tx
      .select({
        item: roadStatus.item,
        state: roadStatus.state,
        source_url: roadStatus.source_url,
        updated_at: roadStatus.updated_at,
      })
      .from(roadStatus)
      .orderBy(asc(roadStatus.item)),
  );
}
