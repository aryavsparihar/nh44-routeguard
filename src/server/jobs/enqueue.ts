import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { jobPayloads, type JobName, type JobPayload } from "./jobs.schemas";

// Adds a job inside the caller's own db.rls() transaction, so the write and
// its job are saved together or not at all (an "outbox"):
//
//   await db.rls(async (tx) => {
//     const row = await tx.insert(...).returning();
//     await tx.execute(enqueueSql("official_update.created", { update_id: row.id }));
//   });
//
// The payload is checked here and again by the database function.
export function enqueueSql<J extends JobName>(job: J, payload: JobPayload<J>): SQL {
  const checked = jobPayloads[job].parse(payload);
  return sql`select private.enqueue_job(${job}::text, ${JSON.stringify(checked)}::jsonb) as msg_id`;
}
