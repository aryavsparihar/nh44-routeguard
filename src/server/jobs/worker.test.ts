import { PgDialect } from "drizzle-orm/pg-core";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { enqueueSql } from "./enqueue";
import { isJobName, JOB_NAMES } from "./jobs.schemas";
import { errorText, runQueue, type Handlers, type Queue, type QueuedJob } from "./worker";

vi.mock("server-only", () => ({}));

const log = pino({ level: "silent" });
const R1 = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const U1 = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

function job(msg_id: number, name: string, payload: unknown, read_ct = 1): QueuedJob {
  return { msg_id, read_ct, enqueued_at: "2026-11-26T09:30:00Z", job: name, payload };
}

// An in-memory queue: read() hands out what is left, ack/fail record calls.
function fakeQueue(batches: QueuedJob[][], failAnswer: "retry" | "dead" = "retry") {
  const acked: number[] = [];
  const failed: { id: number; error: string }[] = [];
  const queue: Queue = {
    read: vi.fn(async () => batches.shift() ?? []),
    ack: vi.fn(async (id) => void acked.push(id)),
    fail: vi.fn(async (id, error) => {
      failed.push({ id, error });
      return failAnswer;
    }),
  };
  return { queue, acked, failed };
}

const okHandlers = (): Handlers => ({
  "report.created": vi.fn(async () => {}),
  "report.confirmed": vi.fn(async () => {}),
  "official_update.created": vi.fn(async () => {}),
});

describe("runQueue", () => {
  it("acks each job its handler finished and stops when the queue is empty", async () => {
    const h = okHandlers();
    const { queue, acked } = fakeQueue([[job(1, "report.created", { report_id: R1 }), job(2, "official_update.created", { update_id: U1 })]]);
    const summary = await runQueue(queue, h, log);
    expect(summary).toEqual({ done: 2, retry: 0, dead: 0, runs: 1 });
    expect(acked).toEqual([1, 2]);
    expect(h["report.created"]).toHaveBeenCalledWith({ report_id: R1 }, expect.anything());
    expect(h["official_update.created"]).toHaveBeenCalledWith({ update_id: U1 }, expect.anything());
  });

  it("fails (not acks) a job whose handler throws, and keeps going", async () => {
    const h = okHandlers();
    h["report.created"] = vi.fn(async () => {
      throw new Error("push service answered 500");
    });
    const { queue, acked, failed } = fakeQueue([[job(1, "report.created", { report_id: R1 }), job(2, "report.confirmed", { report_id: R1 })]]);
    const summary = await runQueue(queue, h, log);
    expect(summary).toMatchObject({ done: 1, retry: 1, dead: 0 });
    expect(acked).toEqual([2]);
    expect(failed).toEqual([{ id: 1, error: "Error: push service answered 500" }]);
  });

  it("counts a job the database moved to the dead letters", async () => {
    const h = okHandlers();
    h["report.created"] = vi.fn(async () => Promise.reject(new Error("still broken")));
    const { queue } = fakeQueue([[job(1, "report.created", { report_id: R1 }, 5)]], "dead");
    expect(await runQueue(queue, h, log)).toMatchObject({ done: 0, dead: 1 });
  });

  it("fails a job with an unknown name or a payload that doesn't match", async () => {
    const { queue, failed } = fakeQueue([[job(1, "user.deleted", {}), job(2, "report.created", { report_id: "nope" })]]);
    const summary = await runQueue(queue, okHandlers(), log);
    expect(summary.retry).toBe(2);
    expect(failed[0].error).toMatch(/No handler for job "user.deleted"/);
    expect(failed[1].error).toMatch(/^ZodError/);
  });

  it("reads again after a full batch, until a short one", async () => {
    const full = Array.from({ length: 10 }, (_, i) => job(i + 1, "report.created", { report_id: R1 }));
    const { queue } = fakeQueue([full, [job(11, "report.created", { report_id: R1 })]]);
    expect(await runQueue(queue, okHandlers(), log)).toMatchObject({ done: 11, runs: 2 });
  });

  it("stops taking jobs when the time budget is used up", async () => {
    let t = 0;
    const full = () => Array.from({ length: 10 }, (_, i) => job(i + 1, "report.created", { report_id: R1 }));
    const { queue } = fakeQueue([full(), full(), full()]);
    const summary = await runQueue(queue, okHandlers(), log, { budgetMs: 100, now: () => (t += 60) });
    expect(summary.runs).toBe(1);
  });
});

describe("errorText", () => {
  it("is the name and message, at most 500 characters", () => {
    expect(errorText(new TypeError("bad"))).toBe("TypeError: bad");
    expect(errorText(new Error("x".repeat(900)))).toHaveLength(500);
    expect(errorText("a string")).toBe("Unknown error");
  });
});

describe("enqueueSql", () => {
  const dialect = new PgDialect();

  it("sends the job name and payload as bound parameters", () => {
    const q = dialect.sqlToQuery(enqueueSql("report.created", { report_id: R1 }));
    expect(q.sql).toContain("private.enqueue_job($1::text, $2::jsonb)");
    expect(q.params).toEqual(["report.created", JSON.stringify({ report_id: R1 })]);
  });

  it("refuses a payload that doesn't match the job", () => {
    expect(() => enqueueSql("report.created", { report_id: "x" })).toThrow();
    expect(() => enqueueSql("report.created", { report_id: R1, phone: "98" } as never)).toThrow();
  });

  it("knows the same three jobs as private.enqueue_job()", () => {
    expect(JOB_NAMES.sort()).toEqual(["official_update.created", "report.confirmed", "report.created"]);
    expect(isJobName("toString")).toBe(false);
  });
});
