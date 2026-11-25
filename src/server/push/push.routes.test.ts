// GET/POST/DELETE /api/v1/push/subscriptions. The repository is faked; the
// SQL functions are checked in supabase/tests/rls.test.sql ("Web Push").
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateVAPIDKeys } from "web-push";
import type { Caller } from "@/src/server/http/caller";

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));
vi.mock("@/src/server/http/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/rate-limit")>()),
  checkRateLimit: async () => {},
}));
const repo = vi.hoisted(() => ({ saveSubscription: vi.fn(), listMySubscriptions: vi.fn(), deleteSubscription: vi.fn() }));
vi.mock("@/src/server/push/push.repository", () => repo);

const route = await import("@/app/api/v1/push/subscriptions/route");

const keys = generateVAPIDKeys();
const DRIVER: Caller = { userId: "user_driver1", role: "driver" };
const EP = "https://fcm.googleapis.com/fcm/send/abc123";
const body = { endpoint: EP, keys: { p256dh: "B".padEnd(87, "A"), auth: "a".repeat(22) }, zones: [4, 3, 4], language: "ur" };
const noParams = { params: Promise.resolve({}) };

function req(method: string, b?: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/push/subscriptions", {
    method,
    headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" },
    body: b === undefined ? undefined : JSON.stringify(b),
  });
}

beforeEach(() => {
  fakeCaller = DRIVER;
  repo.saveSubscription.mockReset().mockResolvedValue({ id: "s1" });
  repo.listMySubscriptions.mockReset().mockResolvedValue([]);
  repo.deleteSubscription.mockReset().mockResolvedValue(1);
  vi.stubEnv("VAPID_PUBLIC_KEY", keys.publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
  vi.stubEnv("VAPID_SUBJECT", "mailto:team@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/v1/push/subscriptions", () => {
  it("needs a signed-in user", async () => {
    fakeCaller = null;
    expect((await route.GET(req("GET"), noParams)).status).toBe(401);
    expect((await route.POST(req("POST", body), noParams)).status).toBe(401);
    expect((await route.DELETE(req("DELETE", { endpoint: EP }), noParams)).status).toBe(401);
  });

  it("turns alerts on: 201 the first time, 200 after", async () => {
    let res = await route.POST(req("POST", body), noParams);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: "s1", zones: [3, 4], language: "ur" } });
    expect(repo.saveSubscription).toHaveBeenCalledWith({}, body);
    repo.listMySubscriptions.mockResolvedValue([{ endpoint: EP }]);
    res = await route.POST(req("POST", body), noParams);
    expect(res.status).toBe(200);
  });

  it("refuses an endpoint that isn't a browser push service (422)", async () => {
    const res = await route.POST(req("POST", { ...body, endpoint: "https://169.254.169.254/latest" }), noParams);
    expect(res.status).toBe(422);
    expect(repo.saveSubscription).not.toHaveBeenCalled();
  });

  it("is 503 while push isn't set up", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect((await route.POST(req("POST", body), noParams)).status).toBe(503);
  });

  it("turns alerts off with 204, whether or not the row was yours", async () => {
    repo.deleteSubscription.mockResolvedValue(0);
    const res = await route.DELETE(req("DELETE", { endpoint: EP }), noParams);
    expect(res.status).toBe(204);
    expect(repo.deleteSubscription).toHaveBeenCalledWith({}, EP);
  });

  it("lists your browsers", async () => {
    repo.listMySubscriptions.mockResolvedValue([{ id: "s1", endpoint: EP, zones: [3] }]);
    const res = await route.GET(req("GET"), noParams);
    expect((await res.json()).meta.count).toBe(1);
  });
});
