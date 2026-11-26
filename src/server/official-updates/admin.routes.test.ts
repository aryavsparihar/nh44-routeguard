// Tests for the admin routes of slice B3:
//   GET/POST  /api/v1/admin/official-updates
//   PATCH/DELETE /api/v1/admin/official-updates/{id}
//   PATCH     /api/v1/admin/road-status
//   GET       /api/v1/admin/audit-log
// The repositories are faked; the SQL they send is checked against the real
// policies in supabase/tests/rls.test.sql.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/src/server/http/caller";
import { ConflictError } from "@/src/server/http/errors";

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));

const updates = vi.hoisted(() => ({
  listActiveUpdates: vi.fn(),
  listAllUpdates: vi.fn(),
  insertUpdate: vi.fn(),
  replaceUpdate: vi.fn(),
  softDeleteUpdate: vi.fn(),
}));
vi.mock("@/src/server/official-updates/official-updates.repository", () => updates);

const road = vi.hoisted(() => ({ listRoadStatus: vi.fn(), setRoadStatus: vi.fn() }));
vi.mock("@/src/server/road-status/road-status.repository", () => road);

const audit = vi.hoisted(() => ({ listAuditLog: vi.fn() }));
vi.mock("@/src/server/audit-log/audit-log.repository", () => audit);

const updatesRoute = await import("@/app/api/v1/admin/official-updates/route");
const updateRoute = await import("@/app/api/v1/admin/official-updates/[id]/route");
const roadRoute = await import("@/app/api/v1/admin/road-status/route");
const auditRoute = await import("@/app/api/v1/admin/audit-log/route");

const ID = "6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
// The police role was merged into TCU on 26 Nov 2026. An old police token
// reaches the routes as a signed-in caller with no role (caller.ts); POLICE
// checks the access list itself in case one ever got through.
const POLICE: Caller = { userId: "user_police1", role: "police" };
const OLD_POLICE_TOKEN: Caller = { userId: "user_police1", role: null };
const ADMIN: Caller = { userId: "user_admin1", role: "admin" };
const DRIVER: Caller = { userId: "user_driver1", role: "driver" };

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const noParams = { params: Promise.resolve({}) };
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

const hour = 3_600_000;
const validUpdate = () => ({
  zone_id: 3,
  kind: "closure",
  title: "NH-44 closed at Digdol",
  body: "Shooting stones. Traffic held at Ramban.",
  source_url: "https://example.com/jk-traffic/advisory-26-nov",
  source_name: "J&K Traffic Police advisory",
  issued_at: new Date(Date.now() - hour).toISOString(),
  valid_until: new Date(Date.now() + 6 * hour).toISOString(),
});

const ROW = { id: ID, version: 1, created_at: new Date("2026-11-25T10:00:00.123Z") };

beforeEach(() => {
  fakeCaller = null;
  vi.clearAllMocks();
});

describe("POST /api/v1/admin/official-updates", () => {
  const path = "/api/v1/admin/official-updates";
  const post = (body: unknown, headers?: Record<string, string>) =>
    updatesRoute.POST(request("POST", path, body, headers), noParams);

  it("is 401 signed out and 403 for a driver", async () => {
    expect((await post(validUpdate())).status).toBe(401);
    fakeCaller = DRIVER;
    expect((await post(validUpdate())).status).toBe(403);
    expect(updates.insertUpdate).not.toHaveBeenCalled();
  });

  it("is 403 for an old police token, and TCU still passes", async () => {
    for (const caller of [POLICE, OLD_POLICE_TOKEN]) {
      fakeCaller = caller;
      expect((await post(validUpdate())).status).toBe(403);
      const edit = request("PATCH", `/api/v1/admin/official-updates/${ID}`, { title: "x", reason: "y" });
      expect((await updateRoute.PATCH(edit, withId(ID))).status).toBe(403);
    }
    expect(updates.insertUpdate).not.toHaveBeenCalled();
    fakeCaller = ADMIN;
    updates.insertUpdate.mockResolvedValue(ROW);
    expect((await post(validUpdate())).status).toBe(201);
  });

  it("is 403 without our Origin (CSRF)", async () => {
    fakeCaller = ADMIN;
    const res = await post(validUpdate(), { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("creates the update as the caller, with 201 and Location", async () => {
    fakeCaller = ADMIN;
    updates.insertUpdate.mockResolvedValue(ROW);

    const res = await post(validUpdate());

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v1/admin/official-updates/${ID}`);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const [, createdBy, input, auditInfo] = updates.insertUpdate.mock.calls[0];
    expect(createdBy).toBe("user_admin1");
    expect(input.issued_at).toBeInstanceOf(Date);
    expect(input.title).toBe("NH-44 closed at Digdol");
    expect(auditInfo.requestId).toEqual(expect.any(String));
  });

  it("allows a whole-road update with no zone and no body", async () => {
    fakeCaller = ADMIN;
    updates.insertUpdate.mockResolvedValue(ROW);
    const whole: Record<string, unknown> = validUpdate();
    delete whole.zone_id;
    delete whole.body;

    expect((await post(whole)).status).toBe(201);
    expect(updates.insertUpdate.mock.calls[0][2]).toMatchObject({ zone_id: null, body: null });
  });

  it.each([
    ["an http:// source", { source_url: "http://example.com/x" }, "source_url"],
    ["a javascript: source", { source_url: "javascript:alert(1)" }, "source_url"],
    ["a source with a password", { source_url: "https://a:b@example.com/x" }, "source_url"],
    ["no source", { source_url: undefined }, "source_url"],
    ["an end before the start", { valid_until: new Date(Date.now() - 2 * hour).toISOString() }, "valid_until"],
    ["an issue time in the future", { issued_at: new Date(Date.now() + 2 * hour).toISOString() }, "issued_at"],
    ["a time without an offset", { issued_at: "2026-11-25T10:00:00" }, "issued_at"],
    ["zone 7", { zone_id: 7 }, "zone_id"],
    ["an unknown kind", { kind: "rumour" }, "kind"],
    ["a 121-character title", { title: "a".repeat(121) }, "title"],
    ["a field we don't take", { created_by: "user_admin1" }, "created_by"],
  ])("refuses %s with 422", async (_name, change, field) => {
    fakeCaller = ADMIN;
    const res = await post({ ...validUpdate(), ...change });

    expect(res.status).toBe(422);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
    const problem = await res.json();
    expect(problem.errors.map((e: { path: string }) => e.path)).toContain(field);
    expect(updates.insertUpdate).not.toHaveBeenCalled();
  });

  it("passes a database clash on as 409", async () => {
    fakeCaller = ADMIN;
    updates.insertUpdate.mockRejectedValue(new ConflictError("Your account has no RouteGuard profile yet."));
    expect((await post(validUpdate())).status).toBe(409);
  });
});

describe("GET /api/v1/admin/official-updates", () => {
  const get = (query = "") =>
    updatesRoute.GET(request("GET", `/api/v1/admin/official-updates${query}`), noParams);

  it("is 403 for a driver", async () => {
    fakeCaller = DRIVER;
    expect((await get()).status).toBe(403);
  });

  it("pages with a cursor of the last row", async () => {
    fakeCaller = ADMIN;
    updates.listAllUpdates.mockResolvedValue([ROW, { ...ROW, id: "x" }]);

    const res = await get("?limit=1");
    const body = await res.json();

    expect(body.data).toHaveLength(1);
    expect(body.meta.next_cursor).toBe(`${ROW.created_at.getTime()}_${ID}`);
    expect(updates.listAllUpdates.mock.calls[0][1]).toEqual({ limit: 1, after: undefined });
  });

  it("reads a cursor back", async () => {
    fakeCaller = ADMIN;
    updates.listAllUpdates.mockResolvedValue([]);
    await get(`?cursor=${ROW.created_at.getTime()}_${ID}`);
    expect(updates.listAllUpdates.mock.calls[0][1].after).toEqual({ createdAt: ROW.created_at, id: ID });
  });

  it("is 400 for a made-up cursor", async () => {
    fakeCaller = ADMIN;
    expect((await get("?cursor=1' or 1=1")).status).toBe(400);
  });
});

describe("PATCH /api/v1/admin/official-updates/{id}", () => {
  const patch = (id: string, body: unknown) =>
    updateRoute.PATCH(request("PATCH", `/api/v1/admin/official-updates/${id}`, body), withId(id));

  it("is 403 for a driver", async () => {
    fakeCaller = DRIVER;
    expect((await patch(ID, { title: "x" })).status).toBe(403);
  });

  it("is 404 for an id that isn't a uuid", async () => {
    fakeCaller = ADMIN;
    expect((await patch("abc", { title: "x" })).status).toBe(404);
    expect(updates.replaceUpdate).not.toHaveBeenCalled();
  });

  it("is 422 when nothing but a reason is sent", async () => {
    fakeCaller = ADMIN;
    expect((await patch(ID, { reason: "typo" })).status).toBe(422);
  });

  it("sends the change without the reason, and the reason to the audit", async () => {
    fakeCaller = ADMIN;
    updates.replaceUpdate.mockResolvedValue({ ...ROW, version: 2 });

    const res = await patch(ID, { title: "NH-44 open one way", reason: "Police reopened one lane" });

    expect(res.status).toBe(200);
    expect((await res.json()).data.version).toBe(2);
    const [, id, editedBy, change, auditInfo] = updates.replaceUpdate.mock.calls[0];
    expect([id, editedBy, change]).toEqual([ID, "user_admin1", { title: "NH-44 open one way" }]);
    expect(auditInfo.reason).toBe("Police reopened one lane");
  });

  it("is 409 when that version was already replaced", async () => {
    fakeCaller = ADMIN;
    updates.replaceUpdate.mockRejectedValue(new ConflictError("already replaced"));
    expect((await patch(ID, { title: "x" })).status).toBe(409);
  });
});

describe("DELETE /api/v1/admin/official-updates/{id}", () => {
  const del = (id: string, body?: unknown) =>
    updateRoute.DELETE(request("DELETE", `/api/v1/admin/official-updates/${id}`, body), withId(id));

  it("needs a reason", async () => {
    fakeCaller = ADMIN;
    expect((await del(ID, {})).status).toBe(422);
    expect((await del(ID, { reason: "   " })).status).toBe(422);
    expect(updates.softDeleteUpdate).not.toHaveBeenCalled();
  });

  it("soft deletes with the reason", async () => {
    fakeCaller = ADMIN;
    updates.softDeleteUpdate.mockResolvedValue({ ...ROW, deleted_at: new Date() });

    const res = await del(ID, { reason: "Posted for the wrong zone" });

    expect(res.status).toBe(200);
    expect(updates.softDeleteUpdate.mock.calls[0].slice(1, 3)).toEqual([ID, "Posted for the wrong zone"]);
  });

  it("is 405 for GET", async () => {
    fakeCaller = ADMIN;
    const res = await updateRoute.GET(request("GET", `/api/v1/admin/official-updates/${ID}`), withId(ID));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("PATCH, DELETE");
  });
});

describe("PATCH /api/v1/admin/road-status", () => {
  const patch = (body: unknown) => roadRoute.PATCH(request("PATCH", "/api/v1/admin/road-status", body), noParams);

  it("is admin only", async () => {
    fakeCaller = POLICE;
    expect((await patch({ item: "mughal_road", state: "unknown" })).status).toBe(403);
  });

  it.each([
    ["open without a source", { item: "mughal_road", state: "open" }],
    ["unknown with a source", { item: "mughal_road", state: "unknown", source_url: "https://example.com/x" }],
    ["an http source", { item: "rail_parcel", state: "open", source_url: "http://example.com/x" }],
    ["another item", { item: "zojila", state: "open", source_url: "https://example.com/x" }],
  ])("refuses %s with 422", async (_name, body) => {
    fakeCaller = ADMIN;
    expect((await patch(body)).status).toBe(422);
    expect(road.setRoadStatus).not.toHaveBeenCalled();
  });

  it("saves the state with its source", async () => {
    fakeCaller = ADMIN;
    const row = { item: "mughal_road", state: "open", source_url: "https://example.com/tcu", updated_at: new Date() };
    road.setRoadStatus.mockResolvedValue(row);

    const res = await patch({ item: "mughal_road", state: "open", source_url: "https://example.com/tcu" });

    expect(res.status).toBe(200);
    const [, by, input] = road.setRoadStatus.mock.calls[0];
    expect(by).toBe("user_admin1");
    expect(input).toEqual({ item: "mughal_road", state: "open", source_url: "https://example.com/tcu" });
  });
});

describe("GET /api/v1/admin/audit-log", () => {
  const get = (query = "") => auditRoute.GET(request("GET", `/api/v1/admin/audit-log${query}`), noParams);

  it("is admin only", async () => {
    expect((await get()).status).toBe(401);
    fakeCaller = POLICE;
    expect((await get()).status).toBe(403);
  });

  it("pages by id and filters by action", async () => {
    fakeCaller = ADMIN;
    audit.listAuditLog.mockResolvedValue([{ id: 9 }, { id: 8 }, { id: 7 }]);

    const res = await get("?limit=2&cursor=10&action=official_update.deleted");
    const body = await res.json();

    expect(body.data).toEqual([{ id: 9 }, { id: 8 }]);
    expect(body.meta.next_cursor).toBe("8");
    expect(audit.listAuditLog.mock.calls[0][1]).toEqual({ limit: 2, before: 10, action: "official_update.deleted" });
  });

  it.each(["?action=DROP TABLE", "?cursor=-1", "?limit=500", "?actor=user_x"])("is 400 for %s", async (q) => {
    fakeCaller = ADMIN;
    expect((await get(q)).status).toBe(400);
  });

  it("is 405 for POST", async () => {
    fakeCaller = ADMIN;
    expect((await auditRoute.POST(request("POST", "/api/v1/admin/audit-log", {}), noParams)).status).toBe(405);
  });
});
