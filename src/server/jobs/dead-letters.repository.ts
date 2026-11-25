import "server-only";
import { desc, lt } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { jobDeadLetters } from "@/src/server/db/schema";

// Jobs that failed 5 times. Admins only (RLS "Admins read dead letters").
// Payloads hold ids only (jobs.schemas.ts).
export async function listDeadLetters(db: Db, opts: { limit: number; before?: number }) {
  return db.rls((tx) =>
    tx
      .select()
      .from(jobDeadLetters)
      .where(opts.before !== undefined ? lt(jobDeadLetters.id, opts.before) : undefined)
      .orderBy(desc(jobDeadLetters.id))
      .limit(opts.limit + 1),
  );
}
