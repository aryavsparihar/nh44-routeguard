// GET /api/v1/risk and /api/v1/risk/summary. The database is faked.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));

const db = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/src/server/db", () => db);

const repo = vi.hoisted(() => ({ latestRunRows: vi.fn(), latestZoneRisk: vi.fn() }));
vi.mock("@/src/server/risk/risk.repository", () => repo);

const { GET: risk } = await import("@/app/api/v1/risk/route");
const { GET: summary } = await import("@/app/api/v1/risk/summary/route");
const { clearRiskCache } = await import("@/src/server/risk/risk.service");

const RUN_AT = new Date("2026-11-25T06:37:14Z");
const noParams = { params: Promise.resolve({}) };
const get = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: { host: "localhost:3000", ...headers } });

function dbRow(zone: number, horizon: number, overall: number) {
  return {
    run_at: RUN_AT,
    zone_id: zone,
    horizon_hours: horizon,
    landslide: overall,
    rockfall: 0,
    flash_flood: 0,
    snow_ice: 0,
    overall,
    risk_low: Math.max(0, overall - 0.1),
    risk_high: Math.min(1, overall + 0.1),
    level: overall > 0.65 ? "high" : overall >= 0.3 ? "medium" : "low",
    top_hazard: overall > 0 ? "landslide" : null,
    confidence: "medium",
    reason: "English",
    reason_code: overall > 0 ? "landslide_rain" : "none",
    reason_params: overall > 0
      ? { mm: 60, hours: 72, place: "z3_nashri", zone, exposure: "very_high" }
      : { zone },
    model_version: "rules-v0.1",
  };
}
const RUN = [0, 12, 24, 48].flatMap((h) => [1, 2, 3, 4, 5, 6].map((z) => dbRow(z, h, z === 3 && h === 24 ? 0.8 : 0)));

beforeEach(() => {
  vi.clearAllMocks();
  clearRiskCache();
  db.getDb.mockResolvedValue({});
  repo.latestRunRows.mockResolvedValue(RUN);
});
afterEach(() => clearRiskCache());

describe("GET /api/v1/risk", () => {
  it("returns every zone and horizon of the newest run, with cache headers", async () => {
    const res = await risk(get("/api/v1/risk"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe(`"risk-${RUN_AT.getTime()}"`);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300, stale-while-revalidate=3300");
    const body = await res.json();
    expect(body.meta).toEqual({ count: 24, next_cursor: null, run_at: RUN_AT.toISOString(), model_version: "rules-v0.1" });
    const z3 = body.data.find((r: { zone_id: number; horizon_hours: number }) => r.zone_id === 3 && r.horizon_hours === 24);
    expect(z3).toMatchObject({ overall: 0.8, level: "high", hazards: { landslide: 0.8, rockfall: 0 }, reason_code: "landslide_rain" });
  });

  it("filters by horizon and zone", async () => {
    const body = await (await risk(get("/api/v1/risk?horizon=24&zone=3"), noParams)).json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ zone_id: 3, horizon_hours: 24 });
  });

  it.each(["?zone=abc", "?zone=7", "?horizon=6", "?horizon=24&extra=1"])("rejects %s with 400 (L7)", async (q) => {
    const res = await risk(get(`/api/v1/risk${q}`), noParams);
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  });

  it("answers 304 when the client has this run", async () => {
    const res = await risk(get("/api/v1/risk", { "if-none-match": `W/"risk-${RUN_AT.getTime()}"` }), noParams);
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
  });

  it("reads the database once a minute, not on every request", async () => {
    await risk(get("/api/v1/risk"), noParams);
    await risk(get("/api/v1/risk?horizon=0"), noParams);
    expect(repo.latestRunRows).toHaveBeenCalledTimes(1);
  });

  it("is 503 problem+json when the database is down", async () => {
    repo.latestRunRows.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const res = await risk(get("/api/v1/risk"), noParams);
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("ECONNREFUSED");
  });

  it("returns an empty list (no ETag) before the first run", async () => {
    repo.latestRunRows.mockResolvedValue([]);
    const res = await risk(get("/api/v1/risk"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeNull();
    expect((await res.json()).meta.run_at).toBeNull();
  });
});

describe("GET /api/v1/risk/summary", () => {
  it("is short plain text in the asked language", async () => {
    const res = await summary(get("/api/v1/risk/summary?lang=hi"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("Content-Language")).toBe("hi");
    const text = await res.text();
    expect(new TextEncoder().encode(text).length).toBeLessThan(5 * 1024);
    expect(text).toContain("सभी ज़ोन कम");
    expect(text).toContain("ज़ोन 3 ऊँचा");
  });

  it("defaults to English and names only raised zones", async () => {
    const text = (await (await summary(get("/api/v1/risk/summary"), noParams)).text()).replace(/[⁨⁩]/g, "");
    expect(text).toContain("Now: all zones low");
    expect(text).toContain("In 24 h: zone 3 High 0.80 (Landslide)");
    expect(text).toContain("not an official");
  });

  it("rejects an unknown language", async () => {
    expect((await summary(get("/api/v1/risk/summary?lang=fr"), noParams)).status).toBe(400);
  });
});
