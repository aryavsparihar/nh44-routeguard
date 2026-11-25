// POST /api/v1/advice and GET /api/v1/road-status. The database is faked.
// The key check (L12): the API and the phone's offline decide() give the
// same answer for the same inputs.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decide, type Lot } from "@/src/shared/decide";
import { levelFor, type RiskRow } from "@/src/shared/risk";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));
const db = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/src/server/db", () => db);
const riskService = vi.hoisted(() => ({ getLatestRun: vi.fn() }));
vi.mock("@/src/server/risk/risk.service", () => riskService);
const roadRepo = vi.hoisted(() => ({ listRoadStatus: vi.fn() }));
vi.mock("@/src/server/road-status/road-status.repository", () => roadRepo);

const { POST: advice, GET: adviceGet } = await import("@/app/api/v1/advice/route");
const { GET: roadStatus } = await import("@/app/api/v1/road-status/route");

const RUN_AT = new Date("2026-11-25T06:37:14Z");
const noParams = { params: Promise.resolve({}) };
const post = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/v1/advice", {
    method: "POST",
    headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

function rows(scores: Record<number, Record<number, number>>): RiskRow[] {
  return [0, 12, 24, 48].flatMap((h) =>
    [1, 2, 3, 4, 5, 6].map((z) => {
      const overall = scores[z]?.[h] ?? 0;
      return {
        zone_id: z,
        horizon_hours: h as 0 | 12 | 24 | 48,
        overall,
        risk_low: overall,
        risk_high: overall,
        level: levelFor(overall),
        top_hazard: null,
        confidence: "medium" as const,
        hazards: { landslide: overall, rockfall: 0, flash_flood: 0, snow_ice: 0 },
        reason: "",
        reason_code: "none",
        reason_params: { zone: z },
      };
    }),
  );
}

const lot: Lot = { variety: "delicious", days_since_picking: 12, tonnes: 10, destination: "azadpur", truck_type: "light" };

beforeEach(() => {
  vi.clearAllMocks();
  db.getDb.mockResolvedValue({});
  roadRepo.listRoadStatus.mockResolvedValue([
    { item: "mughal_road", state: "open", source_url: "https://example.org/tcu", updated_at: RUN_AT },
    { item: "rail_parcel", state: "unknown", source_url: null, updated_at: RUN_AT },
  ]);
});

describe("POST /api/v1/advice", () => {
  it.each([
    ["all low", {}],
    ["medium", { 4: { 12: 0.5 } }],
    ["high for 48 h", { 4: { 0: 0.9, 12: 0.9, 24: 0.9, 48: 0.9 } }],
  ])("gives the same answer as the phone's decide() (%s)", async (_name, scores) => {
    const risk = rows(scores);
    riskService.getLatestRun.mockResolvedValue({ runAt: RUN_AT, modelVersion: "rules-v0.1", rows: risk });
    const res = await advice(post(lot), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const local = decide(lot, { rows: risk, run_at: RUN_AT.toISOString() }, { mughal_road: "open", rail_parcel: "unknown" });
    expect((await res.json()).data).toEqual(JSON.parse(JSON.stringify(local)));
  });

  it.each([
    ["tonnes too high", { ...lot, tonnes: 41 }],
    ["tonnes too low", { ...lot, tonnes: 0 }],
    ["days out of range", { ...lot, days_since_picking: 121 }],
    ["unknown variety", { ...lot, variety: "fuji" }],
    ["unknown field", { ...lot, price: 1 }],
    ["missing field", { variety: "delicious" }],
  ])("is 422 for %s", async (_name, body) => {
    const res = await advice(post(body), noParams);
    expect(res.status).toBe(422);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  });

  it("is 503 when the scores can't be read", async () => {
    riskService.getLatestRun.mockRejectedValue(new Error("down"));
    expect((await advice(post(lot), noParams)).status).toBe(503);
  });

  it("only takes POST", async () => {
    const res = await adviceGet(new NextRequest("http://localhost:3000/api/v1/advice"), noParams);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});

describe("GET /api/v1/road-status", () => {
  it("lists the admin-set status without who set it", async () => {
    const body = await (await roadStatus(new NextRequest("http://localhost:3000/api/v1/road-status"), noParams)).json();
    expect(body.meta.count).toBe(2);
    expect(body.data[0]).not.toHaveProperty("updated_by");
  });
});
