// Routes with a shared rate limit answer 429 problem+json with Retry-After
// once the store says the bucket is full, and check access first.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/src/server/http/caller";

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));

const store = vi.hoisted(() => ({ hitBucket: vi.fn() }));
vi.mock("@/src/server/http/rate-limit.store", () => store);

const { POST: postAdvice } = await import("@/app/api/v1/advice/route");
const { PATCH: patchRole } = await import("@/app/api/v1/admin/users/[id]/role/route");
const { POST: postOnboarding } = await import("@/app/api/v1/me/onboarding/route");

function request(method: string, path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify(body),
  });
}

const full = { allowed: false, hits: 61, retryAfterSeconds: 37 };

beforeEach(() => {
  fakeCaller = null;
  vi.clearAllMocks();
  store.hitBucket.mockResolvedValue(full);
});

describe("rate limited routes", () => {
  it("POST /api/v1/advice: 429 with Retry-After, before reading the body", async () => {
    const res = await postAdvice(request("POST", "/api/v1/advice", { not: "checked" }), { params: Promise.resolve({}) });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("37");
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
    const [bucket, limit, windowSeconds] = store.hitBucket.mock.calls[0];
    expect([limit, windowSeconds]).toEqual([60, 60]);
    expect(bucket).not.toContain("203.0.113.7");
  });

  it("PATCH role: signed out is still 401, not 429", async () => {
    const res = await patchRole(request("PATCH", "/api/v1/admin/users/user_x/role", {}), {
      params: Promise.resolve({ id: "user_x" }),
    });
    expect(res.status).toBe(401);
    expect(store.hitBucket).not.toHaveBeenCalled();
  });

  it("PATCH role: 5 an hour per admin", async () => {
    fakeCaller = { userId: "user_admin1", role: "admin" };
    const res = await patchRole(request("PATCH", "/api/v1/admin/users/user_x/role", {}), {
      params: Promise.resolve({ id: "user_x" }),
    });
    expect(res.status).toBe(429);
    expect(store.hitBucket).toHaveBeenCalledWith("role:user:user_admin1", 5, 3600);
  });

  it("POST onboarding shares the role bucket", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    const res = await postOnboarding(request("POST", "/api/v1/me/onboarding", { role: "driver" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(429);
    expect(store.hitBucket).toHaveBeenCalledWith("role:user:user_new1", 5, 3600);
  });

  it("goes through when the bucket has room", async () => {
    store.hitBucket.mockResolvedValue({ allowed: true, hits: 1, retryAfterSeconds: 0 });
    const res = await postAdvice(request("POST", "/api/v1/advice", { variety: "nope" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
  });
});
