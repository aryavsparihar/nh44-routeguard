// POST /api/v1/internal/jobs/run and GET /api/v1/admin/dead-letters. The
// queue functions are checked against the real database in
// supabase/tests/rls.test.sql ("Job queue").
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/src/server/http/caller";

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}), getWorkerDb: () => ({}) }));

const worker = vi.hoisted(() => ({ runQueue: vi.fn(), dbQueue: vi.fn(() => ({})) }));
vi.mock("@/src/server/jobs/worker", () => worker);
const dead = vi.hoisted(() => ({ listDeadLetters: vi.fn() }));
vi.mock("@/src/server/jobs/dead-letters.repository", () => dead);

const runRoute = await import("@/app/api/v1/internal/jobs/run/route");
const deadRoute = await import("@/app/api/v1/admin/dead-letters/route");

const SECRET = "k".repeat(48);
const noParams = { params: Promise.resolve({}) };

function post(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/v1/internal/jobs/run", {
    method: "POST",
    headers: { host: "localhost:3000", ...headers },
  });
}

beforeEach(() => {
  fakeCaller = null;
  worker.runQueue.mockReset().mockResolvedValue({ done: 2, retry: 0, dead: 0, runs: 1 });
  dead.listDeadLetters.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/v1/internal/jobs/run", () => {
  it("is 503 while JOBS_SECRET is not set, and runs nothing", async () => {
    vi.stubEnv("JOBS_SECRET", "");
    const res = await runRoute.POST(post({ "x-jobs-secret": SECRET }), noParams);
    expect(res.status).toBe(503);
    expect(worker.runQueue).not.toHaveBeenCalled();
  });

  it("is 401 with a wrong or missing secret", async () => {
    vi.stubEnv("JOBS_SECRET", SECRET);
    expect((await runRoute.POST(post(), noParams)).status).toBe(401);
    expect((await runRoute.POST(post({ "x-jobs-secret": "nope" }), noParams)).status).toBe(401);
    expect(worker.runQueue).not.toHaveBeenCalled();
  });

  it("runs the queue with the right secret, without an Origin header", async () => {
    vi.stubEnv("JOBS_SECRET", SECRET);
    const res = await runRoute.POST(post({ "x-jobs-secret": SECRET }), noParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { done: 2, retry: 0, dead: 0, runs: 1 } });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers GET with 405", async () => {
    const res = await runRoute.GET(new NextRequest("http://localhost:3000/api/v1/internal/jobs/run"), noParams);
    expect(res.status).toBe(405);
  });
});

describe("GET /api/v1/admin/dead-letters", () => {
  const get = (q = "") => new NextRequest(`http://localhost:3000/api/v1/admin/dead-letters${q}`);

  it("is for admins only", async () => {
    expect((await deadRoute.GET(get(), noParams)).status).toBe(401);
    fakeCaller = { userId: "user_police1", role: "police" };
    expect((await deadRoute.GET(get(), noParams)).status).toBe(403);
  });

  it("lists a page with a cursor when there are more", async () => {
    fakeCaller = { userId: "user_admin1", role: "admin" };
    dead.listDeadLetters.mockResolvedValue([{ id: 9 }, { id: 8 }, { id: 7 }]);
    const res = await deadRoute.GET(get("?limit=2"), noParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: 9 }, { id: 8 }], meta: { count: 2, next_cursor: "8" } });
    expect(dead.listDeadLetters).toHaveBeenCalledWith({}, { limit: 2, before: undefined });
  });

  it("is 400 for a bad cursor", async () => {
    fakeCaller = { userId: "user_admin1", role: "admin" };
    expect((await deadRoute.GET(get("?cursor=abc"), noParams)).status).toBe(400);
  });
});
