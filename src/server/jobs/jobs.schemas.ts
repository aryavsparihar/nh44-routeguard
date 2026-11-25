import { z } from "zod";

// The jobs the API puts on the queue after a write (BUILD_PROMPT section 17,
// part 2). The same names are allowed by private.enqueue_job() in the
// database (migration 20261125200000_jobs_queue.sql). A payload carries ids
// only: the worker reads the row itself, so no personal data sits in the
// queue or the dead letters.
//
// A job can arrive more than once (a merge into an already confirmed report,
// a worker that died before it said "done"), so every handler must be safe
// to run twice.
export const jobPayloads = {
  "report.created": z.object({ report_id: z.uuid() }).strict(),
  "report.confirmed": z.object({ report_id: z.uuid() }).strict(),
  "official_update.created": z.object({ update_id: z.uuid() }).strict(),
} as const;

export type JobName = keyof typeof jobPayloads;
export type JobPayload<J extends JobName> = z.infer<(typeof jobPayloads)[J]>;
export const JOB_NAMES = Object.keys(jobPayloads) as JobName[];

export function isJobName(name: string): name is JobName {
  return Object.hasOwn(jobPayloads, name);
}

// GET /api/v1/admin/dead-letters?limit=&cursor=. Newest first; the cursor is
// the last row's id.
export const deadLettersQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z
      .string()
      .regex(/^\d{1,15}$/, "Not a cursor from this API.")
      .transform(Number)
      .optional(),
  })
  .strict();
