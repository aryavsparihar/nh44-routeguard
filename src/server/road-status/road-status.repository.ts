import "server-only";
import { asc, eq } from "drizzle-orm";
import { auditSql } from "@/src/server/audit";
import type { Db } from "@/src/server/db";
import { roadStatus } from "@/src/server/db/schema";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, NotFoundError } from "@/src/server/http/errors";
import type { RoadStatusInput } from "./road-status.schemas";

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

export type RoadStatusRow = Awaited<ReturnType<typeof listRoadStatus>>[number];

// Admin only (RLS "Admins update road_status"). The change and its audit
// row (old and new state) are written in one transaction.
export async function setRoadStatus(
  db: Db,
  updatedBy: string,
  input: RoadStatusInput,
  requestId: string,
): Promise<RoadStatusRow> {
  try {
    return await db.rls(async (tx) => {
      const [before] = await tx
        .select({ state: roadStatus.state })
        .from(roadStatus)
        .where(eq(roadStatus.item, input.item))
        .for("update");
      if (!before) throw new NotFoundError("This road status item is missing from the database.");

      const [row] = await tx
        .update(roadStatus)
        .set({ state: input.state, source_url: input.source_url, updated_by: updatedBy })
        .where(eq(roadStatus.item, input.item))
        .returning({
          item: roadStatus.item,
          state: roadStatus.state,
          source_url: roadStatus.source_url,
          updated_at: roadStatus.updated_at,
        });
      await tx.execute(
        auditSql({
          action: "road_status.updated",
          targetType: "road_status",
          targetId: input.item,
          reason: input.reason,
          requestId,
          meta: { from: before.state, to: input.state },
        }),
      );
      return row;
    });
  } catch (err) {
    if (err instanceof DbError && err.code === "23503") {
      throw new ConflictError("Your account has no RouteGuard profile yet. Finish onboarding first.");
    }
    throw err;
  }
}
