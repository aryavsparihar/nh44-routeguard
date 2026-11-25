import "server-only";
import { sql } from "drizzle-orm";
import type { Logger } from "pino";
import type { Db } from "@/src/server/db";
import { isJobName, jobPayloads, type JobName } from "./jobs.schemas";

// One run of the queue worker (POST /api/v1/internal/jobs/run). It takes up
// to 10 jobs at a time, runs each one's handler, and says how it went:
//   done   → private.ack_job deletes it
//   failed → private.fail_job tries again after 30 s, 60 s, ... and after
//            5 tries moves it to job_dead_letters (shown on /admin/jobs)
// until the queue is empty or the time budget is used up. A job that is read
// but never answered (the server stopped) comes back after 60 s.

export type QueuedJob = { msg_id: number; read_ct: number; enqueued_at: string; job: string; payload: unknown };
export type JobHandler = (payload: unknown, ctx: { log: Logger }) => Promise<void>;
export type Handlers = Record<JobName, JobHandler>;

export type Queue = {
  read(qty: number, visibilitySeconds: number): Promise<QueuedJob[]>;
  ack(msgId: number): Promise<void>;
  fail(msgId: number, error: string): Promise<"retry" | "dead" | "gone">;
};

export type RunSummary = { done: number; retry: number; dead: number; runs: number };

export const BATCH = 10;
export const VISIBILITY_SECONDS = 60;
// pg_net waits 30 s for an answer; stop taking new jobs well before that.
export const TIME_BUDGET_MS = 20_000;

export function dbQueue(db: Db): Queue {
  return {
    async read(qty, vt) {
      const rows = await db.rls((tx) =>
        tx.execute<{ msg_id: string | number; read_ct: number; enqueued_at: string; job: string; payload: unknown }>(
          sql`select * from private.read_jobs(${qty}::integer, ${vt}::integer)`,
        ),
      );
      return rows.map((r) => ({ ...r, msg_id: Number(r.msg_id), read_ct: Number(r.read_ct) }));
    },
    async ack(msgId) {
      await db.rls((tx) => tx.execute(sql`select private.ack_job(${msgId}::bigint)`));
    },
    async fail(msgId, error) {
      const rows = await db.rls((tx) =>
        tx.execute<{ outcome: "retry" | "dead" | "gone" }>(
          sql`select private.fail_job(${msgId}::bigint, ${error}::text) as outcome`,
        ),
      );
      return rows[0]?.outcome ?? "gone";
    },
  };
}

// What goes into last_error: the error's name and message, short. Handlers
// must not put personal data in their error messages.
export function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 500);
  return "Unknown error";
}

export async function runOne(job: QueuedJob, handlers: Handlers, log: Logger): Promise<void> {
  if (!isJobName(job.job)) throw new Error(`No handler for job "${job.job.slice(0, 60)}"`);
  const payload = jobPayloads[job.job].parse(job.payload);
  await handlers[job.job](payload, { log });
}

export async function runQueue(
  queue: Queue,
  handlers: Handlers,
  log: Logger,
  opts: { budgetMs?: number; now?: () => number } = {},
): Promise<RunSummary> {
  const now = opts.now ?? (() => performance.now());
  const deadline = now() + (opts.budgetMs ?? TIME_BUDGET_MS);
  const summary: RunSummary = { done: 0, retry: 0, dead: 0, runs: 0 };

  while (now() < deadline) {
    const jobs = await queue.read(BATCH, VISIBILITY_SECONDS);
    summary.runs++;
    if (jobs.length === 0) break;
    for (const job of jobs) {
      const jobLog = log.child({ job: job.job, msg_id: job.msg_id, attempt: job.read_ct });
      try {
        await runOne(job, handlers, jobLog);
        await queue.ack(job.msg_id);
        summary.done++;
        jobLog.info("job done");
      } catch (err) {
        const outcome = await queue.fail(job.msg_id, errorText(err));
        if (outcome === "dead") summary.dead++;
        else if (outcome === "retry") summary.retry++;
        jobLog.warn({ err: { name: (err as Error)?.name }, outcome }, "job failed");
      }
    }
    if (jobs.length < BATCH) break;
  }
  return summary;
}
