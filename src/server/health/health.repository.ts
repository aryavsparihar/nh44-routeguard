import "server-only";
import type { Db } from "@/src/server/db";

// run_at of the newest risk job run (zone rows), or null if there is none.
// Any failure is returned as-is; the route decides what it means.
export async function latestRunAt(
  db: Db,
): Promise<{ runAt: string | null; failed: boolean }> {
  const { data, error } = await db
    .from("latest_risk")
    .select("run_at")
    .is("h3_index", null)
    .limit(1);
  if (error) return { runAt: null, failed: true };
  return { runAt: data?.[0]?.run_at ?? null, failed: false };
}
