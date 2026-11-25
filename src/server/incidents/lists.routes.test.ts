// Public list routes: zones, incidents, official updates, reports.
// The database is faked; these check the query rules and the response shape.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));
const db = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/src/server/db", () => db);

const zonesRepo = vi.hoisted(() => ({ listZones: vi.fn(), countZones: vi.fn() }));
vi.mock("@/src/server/zones/zones.repository", () => zonesRepo);
const incidentsRepo = vi.hoisted(() => ({ listVerifiedIncidents: vi.fn() }));
vi.mock("@/src/server/incidents/incidents.repository", () => incidentsRepo);
const updatesRepo = vi.hoisted(() => ({ listActiveUpdates: vi.fn() }));
vi.mock("@/src/server/official-updates/official-updates.repository", () => updatesRepo);
const reportsRepo = vi.hoisted(() => ({ listActiveReports: vi.fn(), ACTIVE_STATUSES: ["unconfirmed", "confirmed"] }));
vi.mock("@/src/server/reports/reports.repository", () => reportsRepo);

const { GET: zones } = await import("@/app/api/v1/zones/route");
const { GET: incidents } = await import("@/app/api/v1/incidents/route");
const { GET: updates } = await import("@/app/api/v1/official-updates/route");
const { GET: reports, PUT: reportsPut } = await import("@/app/api/v1/reports/route");

const noParams = { params: Promise.resolve({}) };
const get = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: { host: "localhost:3000" } });

beforeEach(() => {
  vi.clearAllMocks();
  db.getDb.mockResolvedValue({});
});

describe("GET /api/v1/zones", () => {
  it("lists the zones", async () => {
    zonesRepo.listZones.mockResolvedValue([{ id: 1, name: "Jammu → Udhampur" }]);
    const res = await zones(get("/api/v1/zones"), noParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: 1, name: "Jammu → Udhampur" }], meta: { count: 1, next_cursor: null } });
  });
});

describe("GET /api/v1/incidents", () => {
  const row = (id: number, date: string) => ({ id, date, zone_id: 3, hazard_type: "landslide" });

  it("pages with a cursor of the last row's date and id", async () => {
    incidentsRepo.listVerifiedIncidents.mockResolvedValue([row(9, "2026-07-22"), row(8, "2026-07-22"), row(7, "2026-04-06")]);
    const body = await (await incidents(get("/api/v1/incidents?limit=2&zone=3"), noParams)).json();
    expect(body.data).toHaveLength(2);
    expect(body.meta.next_cursor).toBe("2026-07-22_8");
    expect(incidentsRepo.listVerifiedIncidents).toHaveBeenCalledWith({}, { zone: 3, limit: 2, after: undefined });
  });

  it("passes the cursor on and ends with next_cursor null", async () => {
    incidentsRepo.listVerifiedIncidents.mockResolvedValue([row(7, "2026-04-06")]);
    const body = await (await incidents(get("/api/v1/incidents?limit=2&cursor=2026-07-22_8"), noParams)).json();
    expect(body.meta.next_cursor).toBeNull();
    expect(incidentsRepo.listVerifiedIncidents.mock.calls[0][1].after).toEqual({ date: "2026-07-22", id: 8 });
  });

  it.each(["?limit=101", "?limit=0", "?cursor=abc", "?cursor=2026-07-22_8;drop", "?zone=0"])("rejects %s", async (q) => {
    expect((await incidents(get(`/api/v1/incidents${q}`), noParams)).status).toBe(400);
  });
});

describe("GET /api/v1/official-updates", () => {
  it("passes the zone on", async () => {
    updatesRepo.listActiveUpdates.mockResolvedValue([]);
    const res = await updates(get("/api/v1/official-updates?zone=4"), noParams);
    expect(res.status).toBe(200);
    expect(updatesRepo.listActiveUpdates).toHaveBeenCalledWith({}, { zone: 4 });
  });

  it("rejects a bad zone", async () => {
    expect((await updates(get("/api/v1/official-updates?zone=x"), noParams)).status).toBe(400);
  });
});

describe("GET /api/v1/reports", () => {
  it("passes zone and status on", async () => {
    reportsRepo.listActiveReports.mockResolvedValue([]);
    await reports(get("/api/v1/reports?zone=2&status=confirmed"), noParams);
    expect(reportsRepo.listActiveReports).toHaveBeenCalledWith({}, { zone: 2, status: "confirmed" });
  });

  it("does not list hidden reports on request", async () => {
    expect((await reports(get("/api/v1/reports?status=hidden"), noParams)).status).toBe(400);
  });

  it("refuses PUT and names the methods it takes (POST is tested in reports.routes.test.ts)", async () => {
    const res = await reportsPut(get("/api/v1/reports"), noParams);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, POST, HEAD");
  });
});
