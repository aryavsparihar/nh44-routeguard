// Tests for the shipment and fleet routes (D4):
//   GET/POST /api/v1/shipments, GET/PATCH /api/v1/shipments/{id},
//   POST /api/v1/shipments/{id}/location, GET/POST /api/v1/agents/invites,
//   POST /api/v1/agents/invites/accept, GET /api/v1/agents/drivers,
//   POST /api/v1/agents/drivers/{driverId}/vouch.
// The repositories are faked here; the database rules behind them (RLS, the
// fleet functions, the driver trigger) are checked in rls.test.sql.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/src/server/http/caller";
import { ConflictError, NotFoundError, ValidationError } from "@/src/server/http/errors";
import { daysSincePicking, istToday } from "./shipments.schemas";

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));
vi.mock("@/src/server/http/rate-limit.store", () => ({
  hitBucket: async () => ({ allowed: true, hits: 1, retryAfterSeconds: 0 }),
}));
vi.mock("@/src/server/risk/risk.service", () => ({
  getLatestRun: async () => ({ runAt: null, modelVersion: null, rows: [] }),
}));
vi.mock("@/src/server/road-status/road-status.service", () => ({
  getRoadStatus: async () => ({ mughal_road: "unknown", rail_parcel: "unknown" }),
}));

const clerk = vi.hoisted(() => ({ token: "header.payload.signature" as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ getToken: async () => clerk.token }) }));

const shipRepo = vi.hoisted(() => ({
  listShipments: vi.fn(),
  getShipment: vi.fn(),
  insertShipment: vi.fn(),
  updateShipment: vi.fn(),
  sendLocation: vi.fn(),
}));
vi.mock("@/src/server/shipments/shipments.repository", () => shipRepo);

const fleetRepo = vi.hoisted(() => ({
  createInvite: vi.fn(),
  listInvites: vi.fn(),
  acceptInvite: vi.fn(),
  listDrivers: vi.fn(),
  vouchDriver: vi.fn(),
}));
vi.mock("@/src/server/fleet/fleet.repository", () => fleetRepo);

const shipmentsRoute = await import("@/app/api/v1/shipments/route");
const oneRoute = await import("@/app/api/v1/shipments/[id]/route");
const locationRoute = await import("@/app/api/v1/shipments/[id]/location/route");
const invitesRoute = await import("@/app/api/v1/agents/invites/route");
const acceptRoute = await import("@/app/api/v1/agents/invites/accept/route");
const driversRoute = await import("@/app/api/v1/agents/drivers/route");
const tokenRoute = await import("@/app/api/v1/me/realtime-token/route");
const vouchRoute = await import("@/app/api/v1/agents/drivers/[driverId]/vouch/route");

const ID = "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f";
const AGENT: Caller = { userId: "user_agent1", role: "agent" };
const GROWER: Caller = { userId: "user_grower1", role: "grower" };
const DRIVER: Caller = { userId: "user_driver1", role: "driver" };
const POLICE: Caller = { userId: "user_police1", role: "police" };
const none = { params: Promise.resolve({}) };
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

function req(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function daysAgo(n: number): string {
  const d = new Date(`${istToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const LOT = { variety: "delicious", harvest_date: daysAgo(3), tonnes: 9, destination: "azadpur", truck_type: "heavy" };

const ROW = { id: ID, status: "planned", created_at: new Date("2026-11-25T10:00:00.000Z") };

beforeEach(() => {
  fakeCaller = null;
  vi.clearAllMocks();
  shipRepo.insertShipment.mockResolvedValue(ID);
  shipRepo.getShipment.mockResolvedValue(ROW);
});

describe("days since picking (IST)", () => {
  it("counts whole days in India time", () => {
    // 20:00 UTC on 25 Nov is already 26 Nov in India.
    const now = new Date("2026-11-25T20:00:00Z");
    expect(istToday(now)).toBe("2026-11-26");
    expect(daysSincePicking("2026-11-20", now)).toBe(6);
  });
});

describe("GET /api/v1/shipments", () => {
  it("is 401 signed out and 403 for police", async () => {
    expect((await shipmentsRoute.GET(req("GET", "/api/v1/shipments"), none)).status).toBe(401);
    fakeCaller = POLICE;
    expect((await shipmentsRoute.GET(req("GET", "/api/v1/shipments"), none)).status).toBe(403);
  });

  it("pages with next_cursor and reads the cursor back", async () => {
    fakeCaller = AGENT;
    shipRepo.listShipments.mockResolvedValue([ROW, { ...ROW, id: "9c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f" }]);
    const res = await shipmentsRoute.GET(req("GET", "/api/v1/shipments?limit=1&status=planned"), none);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta.next_cursor).toBe(`${ROW.created_at.getTime()}_${ID}`);
    expect(shipRepo.listShipments.mock.calls[0][1]).toMatchObject({ status: "planned", limit: 1 });

    await shipmentsRoute.GET(req("GET", `/api/v1/shipments?cursor=${body.meta.next_cursor}`), none);
    expect(shipRepo.listShipments.mock.calls[1][1].after).toEqual({ createdAt: ROW.created_at, id: ID });
  });

  it("is 400 for a cursor it didn't make", async () => {
    fakeCaller = AGENT;
    expect((await shipmentsRoute.GET(req("GET", "/api/v1/shipments?cursor=abc"), none)).status).toBe(400);
  });
});

describe("POST /api/v1/shipments", () => {
  const post = (body: unknown) => shipmentsRoute.POST(req("POST", "/api/v1/shipments", body), none);

  it("is 403 for a driver", async () => {
    fakeCaller = DRIVER;
    expect((await post(LOT)).status).toBe(403);
  });

  it("saves a grower's lot with no agent and the advice at that moment", async () => {
    fakeCaller = GROWER;
    const res = await post({ ...LOT, truck_number: "jk 05 g 7712" });
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v1/shipments/${ID}`);
    const row = shipRepo.insertShipment.mock.calls[0][1];
    expect(row).toMatchObject({ created_by: "user_grower1", agent_id: null, driver_id: null, truck_number: "JK05G7712" });
    expect(row.advice).toMatchObject({ decision: expect.any(String), rules_version: expect.any(String) });
    expect((await res.json()).data.advice.decision).toBe(row.advice.decision);
  });

  it("lets only an agent assign a driver", async () => {
    fakeCaller = GROWER;
    expect((await post({ ...LOT, driver_id: "user_driver1" })).status).toBe(422);
    fakeCaller = AGENT;
    expect((await post({ ...LOT, driver_id: "user_driver1" })).status).toBe(201);
    expect(shipRepo.insertShipment.mock.calls[0][1]).toMatchObject({ agent_id: "user_agent1", driver_id: "user_driver1" });
  });

  it("refuses a future harvest date, unknown fields and bad numbers (422)", async () => {
    fakeCaller = AGENT;
    expect((await post({ ...LOT, harvest_date: daysAgo(-2) })).status).toBe(422);
    expect((await post({ ...LOT, harvest_date: daysAgo(121) })).status).toBe(422);
    expect((await post({ ...LOT, agent_id: "user_other" })).status).toBe(422);
    expect((await post({ ...LOT, tonnes: 0 })).status).toBe(422);
    expect((await post({ ...LOT, variety: "fuji" })).status).toBe(422);
    expect(shipRepo.insertShipment).not.toHaveBeenCalled();
  });

  it("passes on the repository's 409 and 422", async () => {
    fakeCaller = AGENT;
    shipRepo.insertShipment.mockRejectedValueOnce(new ConflictError("This truck already has an active shipment."));
    expect((await post(LOT)).status).toBe(409);
    shipRepo.insertShipment.mockRejectedValueOnce(new ValidationError([{ path: "driver_id", message: "x" }]));
    const res = await post({ ...LOT, driver_id: "user_stranger1" });
    expect(res.status).toBe(422);
    expect((await res.json()).errors[0].path).toBe("driver_id");
  });
});

describe("GET and PATCH /api/v1/shipments/{id}", () => {
  it("is 404 for a bad id or a shipment not on your board", async () => {
    fakeCaller = GROWER;
    expect((await oneRoute.GET(req("GET", "/api/v1/shipments/x"), withId("x"))).status).toBe(404);
    shipRepo.getShipment.mockResolvedValueOnce(null);
    expect((await oneRoute.GET(req("GET", `/api/v1/shipments/${ID}`), withId(ID))).status).toBe(404);
  });

  it("lets only agents change a shipment", async () => {
    fakeCaller = DRIVER;
    expect((await oneRoute.PATCH(req("PATCH", `/api/v1/shipments/${ID}`, { status: "moving" }), withId(ID))).status).toBe(403);
  });

  it("changes only the fields sent, and null clears", async () => {
    fakeCaller = AGENT;
    const res = await oneRoute.PATCH(req("PATCH", `/api/v1/shipments/${ID}`, { status: "moving", driver_id: null }), withId(ID));
    expect(res.status).toBe(200);
    expect(shipRepo.updateShipment.mock.calls[0].slice(1)).toEqual([ID, { status: "moving", driver_id: null }]);
  });

  it("is 422 for an empty or unknown change, 404 from the repository", async () => {
    fakeCaller = AGENT;
    expect((await oneRoute.PATCH(req("PATCH", `/api/v1/shipments/${ID}`, {}), withId(ID))).status).toBe(422);
    expect((await oneRoute.PATCH(req("PATCH", `/api/v1/shipments/${ID}`, { status: "lost" }), withId(ID))).status).toBe(422);
    expect((await oneRoute.PATCH(req("PATCH", `/api/v1/shipments/${ID}`, { tonnes: 3 }), withId(ID))).status).toBe(422);
    shipRepo.updateShipment.mockRejectedValueOnce(new NotFoundError("No shipment."));
    expect((await oneRoute.PATCH(req("PATCH", `/api/v1/shipments/${ID}`, { status: "moving" }), withId(ID))).status).toBe(404);
  });
});

describe("POST /api/v1/shipments/{id}/location", () => {
  const send = (body: unknown) => locationRoute.POST(req("POST", `/api/v1/shipments/${ID}/location`, body), withId(ID));

  it("is for drivers only", async () => {
    fakeCaller = AGENT;
    expect((await send({ lat: 33.24, lng: 75.19 })).status).toBe(403);
  });

  it("sends the position and returns last_seen_at", async () => {
    fakeCaller = DRIVER;
    shipRepo.sendLocation.mockResolvedValue(new Date("2026-11-25T10:00:00Z"));
    const res = await send({ lat: 33.2412, lng: 75.1934 });
    expect(res.status).toBe(200);
    expect((await res.json()).data.last_seen_at).toBe("2026-11-25T10:00:00.000Z");
    expect(shipRepo.sendLocation.mock.calls[0].slice(1)).toEqual([ID, { lat: 33.2412, lng: 75.1934 }]);
  });

  it("refuses a position outside India and a missing consent (409)", async () => {
    fakeCaller = DRIVER;
    expect((await send({ lat: 51.5, lng: -0.1 })).status).toBe(422);
    shipRepo.sendLocation.mockRejectedValueOnce(new ConflictError("Turn on location sharing."));
    expect((await send({ lat: 33.24, lng: 75.19 })).status).toBe(409);
  });
});

describe("agent invites and drivers", () => {
  it("creates an invite for agents only", async () => {
    fakeCaller = DRIVER;
    expect((await invitesRoute.POST(req("POST", "/api/v1/agents/invites", {}), none)).status).toBe(403);
    fakeCaller = AGENT;
    fleetRepo.createInvite.mockResolvedValue({ code: "ABCD2345", expires_at: new Date("2026-12-02T00:00:00Z") });
    const res = await invitesRoute.POST(req("POST", "/api/v1/agents/invites", {}), none);
    expect(res.status).toBe(201);
    expect(fleetRepo.createInvite.mock.calls[0][1]).toBe(7);
    expect((await res.json()).data.code).toBe("ABCD2345");
    expect((await invitesRoute.POST(req("POST", "/api/v1/agents/invites", { days: 31 }), none)).status).toBe(422);
  });

  it("lets a driver join with a code typed in any case, with spaces or dashes", async () => {
    fakeCaller = DRIVER;
    fleetRepo.acceptInvite.mockResolvedValue({ agent_id: "user_agent1", outcome: "joined" });
    const res = await acceptRoute.POST(req("POST", "/api/v1/agents/invites/accept", { code: "abcd-2345" }), none);
    expect(res.status).toBe(200);
    expect(fleetRepo.acceptInvite.mock.calls[0][1]).toBe("ABCD2345");
  });

  it("refuses a code that can't be one (I, O, 0, 1 are never used)", async () => {
    fakeCaller = DRIVER;
    expect((await acceptRoute.POST(req("POST", "/api/v1/agents/invites/accept", { code: "ABCD1234" }), none)).status).toBe(422);
    expect((await acceptRoute.POST(req("POST", "/api/v1/agents/invites/accept", { code: "ABC" }), none)).status).toBe(422);
    expect(fleetRepo.acceptInvite).not.toHaveBeenCalled();
  });

  it("lists the agent's own drivers", async () => {
    fakeCaller = AGENT;
    fleetRepo.listDrivers.mockResolvedValue([{ id: "user_driver1", display_name: "Bashir", verification_level: "email" }]);
    const res = await driversRoute.GET(req("GET", "/api/v1/agents/drivers"), none);
    expect(res.status).toBe(200);
    expect(fleetRepo.listDrivers.mock.calls[0][1]).toBe("user_agent1");
  });

  it("vouches for a driver with the request id for the audit log", async () => {
    fakeCaller = AGENT;
    const ctx = { params: Promise.resolve({ driverId: "user_driver1" }) };
    fleetRepo.vouchDriver.mockResolvedValue({ verification_level: "agent_vouched", outcome: "vouched" });
    const res = await vouchRoute.POST(req("POST", "/api/v1/agents/drivers/user_driver1/vouch"), ctx);
    expect(res.status).toBe(200);
    const [, driver, requestId] = fleetRepo.vouchDriver.mock.calls[0];
    expect(driver).toBe("user_driver1");
    expect(requestId).toBe(res.headers.get("X-Request-Id"));
    const bad = { params: Promise.resolve({ driverId: "robert'); drop" }) };
    expect((await vouchRoute.POST(req("POST", "/api/v1/agents/drivers/x/vouch"), bad)).status).toBe(404);
  });

  it("answers 405 with Allow for other methods", async () => {
    const res = await acceptRoute.GET(req("GET", "/api/v1/agents/invites/accept"), none);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toContain("POST");
  });
});

describe("GET /api/v1/me/realtime-token", () => {
  it("gives a signed-in caller their own session token, never cached", async () => {
    expect((await tokenRoute.GET(req("GET", "/api/v1/me/realtime-token"), none)).status).toBe(401);
    fakeCaller = DRIVER;
    clerk.token = "header.payload.signature";
    const res = await tokenRoute.GET(req("GET", "/api/v1/me/realtime-token"), none);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).data.token).toBe("header.payload.signature");
  });

  it("is 401 when Clerk has no session token", async () => {
    fakeCaller = DRIVER;
    clerk.token = null;
    expect((await tokenRoute.GET(req("GET", "/api/v1/me/realtime-token"), none)).status).toBe(401);
  });
});

