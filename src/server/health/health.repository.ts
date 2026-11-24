import "server-only";
import { isNull } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { latestRisk } from "@/src/server/db/schema";

// run_at of the newest risk job run (zone rows), or null if there is none.
// Any failure is returned as-is; the route decides what it means.
export async function latestRunAt(db: Db): Promise<{ runAt: Date | null; failed: boolean }> {
  try {
    const rows = await db.rls((tx) =>
      tx.select({ run_at: latestRisk.run_at }).from(latestRisk).where(isNull(latestRisk.h3_index)).limit(1),
    );
    return { runAt: rows[0]?.run_at ?? null, failed: false };
  } catch {
    return { runAt: null, failed: true };
  }
}
