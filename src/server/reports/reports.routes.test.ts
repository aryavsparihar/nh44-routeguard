// Tests for the report write routes (B2):
//   POST /api/v1/reports, POST /api/v1/reports/{id}/confirm and /flag,
//   GET /api/v1/reports/{id}/photo, GET and PATCH /api/v1/admin/reports.
// The database functions are faked here and checked in rls.test.sql; photo
// cleaning (sharp) runs for real.
import sharp from "sharp";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/src/server/http/caller";
import { ConflictError, ForbiddenError } from "@/src/server/http/errors";

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));
vi.mock("@/src/server/http/rate-limit.store", () => ({
  hitBucket: async () => ({ allowed: true, hits: 1, retryAfterSeconds: 0 }),
}));

// The caller's own users row (only verification_level is read here).
const users = vi.hoisted(() => ({ findUser: vi.fn() }));
vi.mock("@/src/server/users/users.repository", () => users);

const repo = vi.hoisted(() => ({
  ACTIVE_STATUSES: ["unconfirmed", "confirmed"],
  listActiveReports: vi.fn(),
  submitReport: vi.fn(),
  confirmReport: vi.fn(),
  flagReport: vi.fn(),
  visiblePhotoPath: vi.fn(),
  listReportsForAdmin: vi.fn(),
  moderateReport: vi.fn(),
}));
vi.mock("@/src/server/reports/reports.repository", () => repo);

const storage = vi.hoisted(() => ({
  photoPath: (user: string, id: string) => `${user}/${id}.webp`,
  uploadPhoto: vi.fn(),
  removePhoto: vi.fn(),
  readPhoto: vi.fn(),
}));
vi.mock("@/src/server/reports/storage", () => storage);

const reportsRoute = await import("@/app/api/v1/reports/route");
const confirmRoute = await import("@/app/api/v1/reports/[id]/confirm/route");
const flagRoute = await import("@/app/api/v1/reports/[id]/flag/route");
const photoRoute = await import("@/app/api/v1/reports/[id]/photo/route");
const adminRoute = await import("@/app/api/v1/admin/reports/route");
const adminOneRoute = await import("@/app/api/v1/admin/reports/[id]/route");

const CLIENT_ID = "3b0f7a0e-2d55-4c1a-9a3e-6a1d2c3b4e5f";
const ID = "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f";
const DRIVER: Caller = { userId: "user_driver1", role: "driver" };
const GROWER: Caller = { userId: "user_grower1", role: "grower" };
const ADMIN: Caller = { userId: "user_admin1", role: "admin" };

const headers = (extra: Record<string, string> = {}) => ({
  host: "localhost:3000",
  origin: "http://localhost:3000",
  ...extra,
});

// A point on NH-44 near Ramban (inside the corridor box).
const SPOT = { lat: "33.2420", lng: "75.2380" };

function form(fields: Record<string, string | Blob>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

// The form is encoded to bytes first, as a phone sends it. (Passing undici a
// FormData object directly makes its encoder throw once we stop reading.)
async function postReport(body: FormData | string, extra: Record<string, string> = { "idempotency-key": CLIENT_ID }) {
  let bytes: string | Uint8Array<ArrayBuffer> = body as string;
  let type = "application/json";
  if (typeof body !== "string") {
    const encoded = new Response(body);
    type = encoded.headers.get("content-type")!;
    bytes = new Uint8Array(await encoded.arrayBuffer());
  }
  const req = new NextRequest("http://localhost:3000/api/v1/reports", {
    method: "POST",
    headers: headers({ "content-type": type, ...extra }),
    body: bytes,
  });
  return reportsRoute.POST(req, { params: Promise.resolve({}) });
}

function json(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: headers({ "content-type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });

async function jpegWithGps(): Promise<Blob> {
  const buf = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "grey" } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "33/1 14/1 31/1" } })
    .toBuffer();
  return new Blob([new Uint8Array(buf)], { type: "image/jpeg" });
}

beforeEach(() => {
  fakeCaller = null;
  vi.clearAllMocks();
  repo.submitReport.mockResolvedValue({ id: ID, status: "unconfirmed", outcome: "created" });
  users.findUser.mockResolvedValue({ verification_level: "agent_vouched" });
  storage.uploadPhoto.mockResolvedValue(undefined);
  storage.removePhoto.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.FEATURE_REPORTS_WRITE;
});

describe("POST /api/v1/reports", () => {
  it("is 401 signed out and 403 for a grower", async () => {
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }))).status).toBe(401);
    fakeCaller = GROWER;
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }))).status).toBe(403);
    expect(repo.submitReport).not.toHaveBeenCalled();
  });

  it("is 403 for an old police token (police was merged into TCU)", async () => {
    for (const role of ["police", null] as const) {
      fakeCaller = { userId: "user_police1", role };
      expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }))).status).toBe(403);
    }
    expect(repo.submitReport).not.toHaveBeenCalled();
  });

  it("is 403 for a driver who is not verified, before any photo is read or stored", async () => {
    fakeCaller = DRIVER;
    for (const level of ["email", "none"]) {
      users.findUser.mockResolvedValue({ verification_level: level });
      const res = await postReport(form({ hazard_type: "rockfall", ...SPOT }));
      expect(res.status).toBe(403);
      expect((await res.json()).detail).toContain("vouch");
    }
    users.findUser.mockResolvedValue(null); // no users row yet
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }))).status).toBe(403);
    expect(repo.submitReport).not.toHaveBeenCalled();
    expect(storage.uploadPhoto).not.toHaveBeenCalled();
  });

  it("takes reports from drivers verified either way, and from agents without a check", async () => {
    fakeCaller = DRIVER;
    for (const level of ["agent_vouched", "aadhaar_qr"]) {
      users.findUser.mockResolvedValue({ verification_level: level });
      expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }))).status).toBe(201);
    }
    fakeCaller = { userId: "user_agent1", role: "agent" };
    users.findUser.mockClear();
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }))).status).toBe(201);
    expect(users.findUser).not.toHaveBeenCalled();
  });

  it("needs an Idempotency-Key that is a UUID", async () => {
    fakeCaller = DRIVER;
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }), {})).status).toBe(400);
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }), { "idempotency-key": "abc" })).status).toBe(400);
  });

  it("takes multipart only", async () => {
    fakeCaller = DRIVER;
    expect((await postReport(JSON.stringify({ hazard_type: "rockfall", ...SPOT }))).status).toBe(415);
  });

  it.each([
    ["an unknown hazard", { hazard_type: "traffic", ...SPOT }],
    ["a spot outside the corridor", { hazard_type: "rockfall", lat: "28.61", lng: "77.21" }],
    ["a missing position", { hazard_type: "rockfall" }],
    ["a 281-character note", { hazard_type: "rockfall", ...SPOT, note: "a".repeat(281) }],
    ["a field we don't take", { hazard_type: "rockfall", ...SPOT, status: "confirmed" }],
  ])("refuses %s with 422", async (_name, fields) => {
    fakeCaller = DRIVER;
    expect((await postReport(form(fields))).status).toBe(422);
    expect(repo.submitReport).not.toHaveBeenCalled();
  });

  it("refuses a file that isn't an image, whatever its name", async () => {
    fakeCaller = DRIVER;
    const fake = new Blob(["<svg onload=alert(1)>"], { type: "image/jpeg" });
    const res = await postReport(form({ hazard_type: "rockfall", ...SPOT, photo: new File([fake], "road.jpg") }));
    expect(res.status).toBe(422);
    expect(storage.uploadPhoto).not.toHaveBeenCalled();
  });

  it("creates the report: 201, masked note, zone from the road, photo without EXIF", async () => {
    fakeCaller = DRIVER;
    const photo = new File([await jpegWithGps()], "IMG_0001.jpg", { type: "image/jpeg" });
    const res = await postReport(
      form({ hazard_type: "rockfall", ...SPOT, note: "Stones down. Call 9876543210", photo }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v1/reports/${ID}`);
    expect((await res.json()).data).toEqual({ id: ID, status: "unconfirmed", outcome: "created" });

    const [path, webp] = storage.uploadPhoto.mock.calls[0];
    expect(path).toBe(`user_driver1/${CLIENT_ID}.webp`);
    const meta = await sharp(webp).metadata();
    expect([meta.format, meta.exif, meta.width]).toEqual(["webp", undefined, 1600]);

    const args = repo.submitReport.mock.calls[0][1];
    expect(args).toMatchObject({ clientId: CLIENT_ID, hazard: "rockfall", lat: 33.242, lng: 75.238, photoPath: path });
    expect(args.note).toBe("Stones down. Call •••");
    expect(args.zoneId).toBeGreaterThanOrEqual(1);
  });

  it("answers 200 and drops the new photo when the report merged into an earlier one", async () => {
    fakeCaller = DRIVER;
    repo.submitReport.mockResolvedValue({ id: ID, status: "confirmed", outcome: "merged" });
    const photo = new File([await jpegWithGps()], "a.jpg");

    const res = await postReport(form({ hazard_type: "rockfall", ...SPOT, photo }));

    expect(res.status).toBe(200);
    expect((await res.json()).data.outcome).toBe("merged");
    expect(storage.removePhoto).toHaveBeenCalledWith(`user_driver1/${CLIENT_ID}.webp`);
  });

  it("removes the uploaded photo when the database refuses the report", async () => {
    fakeCaller = DRIVER;
    repo.submitReport.mockRejectedValue(new ConflictError("Finish onboarding first."));
    const res = await postReport(form({ hazard_type: "rockfall", ...SPOT, photo: new File([await jpegWithGps()], "a.jpg") }));
    expect(res.status).toBe(409);
    expect(storage.removePhoto).toHaveBeenCalledOnce();
  });

  it("is 503 while reporting is paused", async () => {
    fakeCaller = DRIVER;
    process.env.FEATURE_REPORTS_WRITE = "false";
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT }))).status).toBe(503);
  });

  it("is 413 for a body over the photo limit", async () => {
    fakeCaller = DRIVER;
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg");
    expect((await postReport(form({ hazard_type: "rockfall", ...SPOT, photo: big }))).status).toBe(413);
  });
});

describe("POST /api/v1/reports/{id}/confirm", () => {
  const confirm = (id: string, body: unknown) =>
    confirmRoute.POST(json("POST", `/api/v1/reports/${id}/confirm`, body), withId(id));

  it("is 403 for a grower and 404 for a bad id", async () => {
    fakeCaller = GROWER;
    expect((await confirm(ID, {})).status).toBe(403);
    fakeCaller = DRIVER;
    expect((await confirm("nope", {})).status).toBe(404);
  });

  it("is 403 for an old police token", async () => {
    for (const role of ["police", null] as const) {
      fakeCaller = { userId: "user_police1", role };
      expect((await confirm(ID, {})).status).toBe(403);
    }
  });

  it("needs lat and lng together", async () => {
    fakeCaller = DRIVER;
    expect((await confirm(ID, { lat: 33.2 })).status).toBe(422);
  });

  it("passes the database's refusal on (own report, unverified)", async () => {
    fakeCaller = DRIVER;
    repo.confirmReport.mockRejectedValue(new ForbiddenError("own report"));
    expect((await confirm(ID, {})).status).toBe(403);
  });

  it("confirms", async () => {
    fakeCaller = DRIVER;
    repo.confirmReport.mockResolvedValue({ status: "confirmed", confirmations: 2, outcome: "confirmed" });
    const res = await confirm(ID, { lat: 33.24, lng: 75.24 });
    expect(res.status).toBe(200);
    expect(repo.confirmReport.mock.calls[0].slice(1, 3)).toEqual([ID, { lat: 33.24, lng: 75.24 }]);
    // The request id goes to the database for the audit log (police/admin confirmations).
    expect(repo.confirmReport.mock.calls[0][3]).toBe(res.headers.get("x-request-id"));
  });
});

describe("POST /api/v1/reports/{id}/flag", () => {
  const flag = (body: unknown) => flagRoute.POST(json("POST", `/api/v1/reports/${ID}/flag`, body), withId(ID));

  it("is 401 signed out and 422 for an unknown reason", async () => {
    expect((await flag({ reason: "not_there" })).status).toBe(401);
    fakeCaller = GROWER;
    expect((await flag({ reason: "boring" })).status).toBe(422);
  });

  it("flags as any signed-in user", async () => {
    fakeCaller = GROWER;
    repo.flagReport.mockResolvedValue({ status: "unconfirmed", outcome: "flagged" });
    expect((await flag({ reason: "not_there" })).status).toBe(200);
  });
});

describe("GET /api/v1/reports/{id}/photo", () => {
  const get = () => photoRoute.GET(json("GET", `/api/v1/reports/${ID}/photo`), withId(ID));

  it("is 404 without a visible photo", async () => {
    repo.visiblePhotoPath.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it("sends the photo bytes itself, so the storage path never reaches the visitor", async () => {
    repo.visiblePhotoPath.mockResolvedValue("user_driver1/x.webp");
    storage.readPhoto.mockResolvedValue(new Uint8Array([82, 73, 70, 70]));
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Location")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]));
    expect(JSON.stringify([...res.headers])).not.toContain("user_driver1");
  });

  it("is 404 when Storage won't give the photo", async () => {
    repo.visiblePhotoPath.mockResolvedValue("user_driver1/x.webp");
    storage.readPhoto.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});

describe("admin reports", () => {
  it("lists for admins only", async () => {
    fakeCaller = { userId: "user_police1", role: "police" };
    expect((await adminRoute.GET(json("GET", "/api/v1/admin/reports"), { params: Promise.resolve({}) })).status).toBe(403);
    fakeCaller = ADMIN;
    repo.listReportsForAdmin.mockResolvedValue([]);
    const res = await adminRoute.GET(json("GET", "/api/v1/admin/reports?status=hidden"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(repo.listReportsForAdmin.mock.calls[0][1]).toMatchObject({ status: "hidden", limit: 50 });
  });

  it("moderates with a reason", async () => {
    fakeCaller = ADMIN;
    const patch = (body: unknown) =>
      adminOneRoute.PATCH(json("PATCH", `/api/v1/admin/reports/${ID}`, body), withId(ID));
    expect((await patch({ action: "hide" })).status).toBe(422);
    expect((await patch({ action: "delete", reason: "x" })).status).toBe(422);
    repo.moderateReport.mockResolvedValue({ id: ID, status: "hidden" });
    expect((await patch({ action: "hide", reason: "A person's face in the photo" })).status).toBe(200);
    expect(repo.moderateReport.mock.calls[0].slice(1, 3)).toEqual([ID, { action: "hide", reason: "A person's face in the photo" }]);
  });
});
