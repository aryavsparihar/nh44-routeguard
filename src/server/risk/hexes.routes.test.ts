// GET /api/v1/risk/hexes. The database is faked; the outlines come from the
// real H3 library.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));

const db = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/src/server/db", () => db);

const repo = vi.hoisted(() => ({ latestRunRows: vi.fn(), latestZoneRisk: vi.fn(), latestHexRows: vi.fn() }));
vi.mock("@/src/server/risk/risk.repository", () => repo);

const { GET } = await import("@/app/api/v1/risk/hexes/route");
const { clearRiskCache } = await import("@/src/server/risk/risk.service");

const RUN_AT = new Date("2026-11-25T06:37:14Z");
const noParams = { params: Promise.resolve({}) };
const get = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: { host: "localhost:3000", ...headers } });
// A real resolution-8 cell at Ramban.
const CELL = "883d308abdfffff";

beforeEach(() => {
  vi.clearAllMocks();
  clearRiskCache();
  db.getDb.mockResolvedValue({});
  repo.latestRunRows.mockResolvedValue([{ run_at: RUN_AT, zone_id: 4, horizon_hours: 0, overall: 0.4, level: "medium" }]);
  repo.latestHexRows.mockResolvedValue([
    { h3_index: CELL, zone_id: 4, landslide: 0.2, rockfall: 0.42, flash_flood: 0.05, snow_ice: null, overall: 0.42, level: "medium", top_hazard: "rockfall", confidence: "low", slope_deg: 16.6,
      reason: "Rain 27 mm in 48 h near Ramban; zone 4 high rockfall", reason_code: "rockfall_rain",
      reason_params: { mm: 27, hours: 48, place: "z4_ramban", zone: 4, exposure: "high" } },
  ]);
});

describe("GET /api/v1/risk/hexes", () => {
  it("returns each cell with a closed outline and cache headers", async () => {
    const res = await GET(get("/api/v1/risk/hexes?horizon=24"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe(`"hex2-${RUN_AT.getTime()}-24"`);
    expect(res.headers.get("cache-control")).toContain("max-age=60");
    const body = await res.json();
    expect(repo.latestHexRows).toHaveBeenCalledWith({}, 24);
    expect(body.meta).toMatchObject({ count: 1, run_at: RUN_AT.toISOString() });
    expect(body.data[0].hazards).toEqual({ landslide: 0.2, rockfall: 0.42, flash_flood: 0.05, snow_ice: 0 });
    expect(body.data[0].slope_deg).toBe(16.6);
    expect(body.data[0]).toMatchObject({ reason_code: "rockfall_rain", reason_params: { zone: 4, place: "z4_ramban" } });
    const ring = body.data[0].boundary;
    expect(ring).toHaveLength(7); // 6 corners, closed
    expect(ring[0]).toEqual(ring[6]);
    expect(ring[0][0]).toBeGreaterThan(74); // [lng, lat] near NH-44
    expect(ring[0][1]).toBeGreaterThan(32);
  });

  it("sends the full list again to a phone holding a copy in the older format", async () => {
    // Before slope_deg and the reason fields: same run, old ETag.
    const old = `"hex-${RUN_AT.getTime()}-0"`;
    const res = await GET(get("/api/v1/risk/hexes", { "if-none-match": old }), noParams);
    expect(res.status).toBe(200);
    expect((await res.json()).data[0].slope_deg).toBe(16.6);
  });

  it("answers 304 when the client has this run and horizon", async () => {
    const etag = `"hex2-${RUN_AT.getTime()}-0"`;
    const res = await GET(get("/api/v1/risk/hexes", { "if-none-match": etag }), noParams);
    expect(res.status).toBe(304);
    expect(repo.latestHexRows).not.toHaveBeenCalled();
  });

  it.each(["?horizon=6", "?horizon=abc", "?zone=4"])("rejects %s with 400", async (q) => {
    const res = await GET(get(`/api/v1/risk/hexes${q}`), noParams);
    expect(res.status).toBe(400);
  });

  it("is empty, not an error, before the first run", async () => {
    repo.latestRunRows.mockResolvedValue([]);
    const res = await GET(get("/api/v1/risk/hexes"), noParams);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });
});
