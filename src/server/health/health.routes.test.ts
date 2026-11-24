// GET /api/v1/health and /api/v1/health/ready. The database is faked.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceUnavailableError } from "@/src/server/http/errors";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));

const db = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/src/server/db", () => db);

const repo = vi.hoisted(() => ({ latestRunAt: vi.fn() }));
vi.mock("@/src/server/health/health.repository", () => repo);

const { GET: health } = await import("@/app/api/v1/health/route");
const { GET: ready } = await import("@/app/api/v1/health/ready/route");

const NOW = new Date("2026-11-24T18:00:00Z");
const noParams = { params: Promise.resolve({}) };
const get = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: { host: "localhost:3000" } });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.clearAllMocks();
  db.getDb.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

describe("GET /api/v1/health", () => {
  it("is 200 without touching the database", async () => {
    const res = await health(get("/api/v1/health"), noParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "ok" } });
    expect(db.getDb).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/health/ready", () => {
  it("reports fresh data", async () => {
    repo.latestRunAt.mockResolvedValue({ runAt: "2026-11-24T17:07:00+00:00", failed: false });
    const res = await ready(get("/api/v1/health/ready"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).data).toEqual({
      status: "ready",
      database: "ok",
      last_run_at: "2026-11-24T17:07:00+00:00",
      data_age_minutes: 53,
      stale: false,
      stale_after_minutes: 90,
    });
  });

  it("is still 200 when the data is stale", async () => {
    repo.latestRunAt.mockResolvedValue({ runAt: "2026-11-24T16:00:00+00:00", failed: false });
    const res = await ready(get("/api/v1/health/ready"), noParams);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ data_age_minutes: 120, stale: true });
  });

  it("counts no run at all as stale", async () => {
    repo.latestRunAt.mockResolvedValue({ runAt: null, failed: false });
    const body = await (await ready(get("/api/v1/health/ready"), noParams)).json();
    expect(body.data).toMatchObject({ last_run_at: null, data_age_minutes: null, stale: true });
  });

  it("is 503 problem+json when the query fails, with no internals", async () => {
    repo.latestRunAt.mockResolvedValue({ runAt: null, failed: true });
    const res = await ready(get("/api/v1/health/ready"), noParams);
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
    const body = await res.json();
    expect(body.detail).toBe("The database is not reachable right now. Try again soon.");
    expect(JSON.stringify(body)).not.toMatch(/supabase|postgres|latest_risk/i);
  });

  it("is 503 when the database isn't set up on this server", async () => {
    db.getDb.mockRejectedValue(new ServiceUnavailableError("The database is not set up on this server."));
    const res = await ready(get("/api/v1/health/ready"), noParams);
    expect(res.status).toBe(503);
    expect(repo.latestRunAt).not.toHaveBeenCalled();
  });
});
