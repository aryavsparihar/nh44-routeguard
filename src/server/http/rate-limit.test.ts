// The shared rate limiter: bucket keys, the client IP rule and what happens
// over the limit. The counter itself (private.rate_limit_hit) is checked in
// supabase/tests/rls.test.sql. Routes are checked in rate-limit.routes.test.ts.
import { describe, expect, it, vi } from "vitest";
import { RateLimitError } from "./errors";
import { bucketFor, checkRateLimit, clientIp, RATE_LIMITS } from "./rate-limit";

vi.mock("./rate-limit.store", () => ({ hitBucket: vi.fn() }));

const headers = (xff?: string) => new Headers(xff ? { "x-forwarded-for": xff } : {});

describe("clientIp", () => {
  it("takes the first X-Forwarded-For entry (the Container Apps ingress)", () => {
    expect(clientIp(headers("203.0.113.7, 10.0.0.1"))).toBe("203.0.113.7");
    expect(clientIp(headers("2001:db8::1"))).toBe("2001:db8::1");
  });

  it("treats a missing or odd header as unknown", () => {
    expect(clientIp(headers())).toBe("unknown");
    expect(clientIp(headers("<script>, 1.2.3.4"))).toBe("unknown");
    expect(clientIp(headers("a".repeat(60)))).toBe("unknown");
  });
});

describe("bucketFor", () => {
  it("keys user limits on the user id", () => {
    expect(bucketFor("role", { userId: "user_1", role: "admin" }, headers())).toBe("role:user:user_1");
  });

  it("keys IP limits on a hash, never the address", () => {
    const bucket = bucketFor("advice", null, headers("203.0.113.7"));
    expect(bucket).toMatch(/^advice:ip:[0-9a-f]{32}$/);
    expect(bucket).not.toContain("203.0.113.7");
    expect(bucketFor("advice", null, headers("203.0.113.7"))).toBe(bucket);
    expect(bucketFor("advice", null, headers("203.0.113.8"))).not.toBe(bucket);
  });

  it("falls back to the IP for a user limit when nobody is signed in", () => {
    expect(bucketFor("report", null, headers("203.0.113.7"))).toMatch(/^report:ip:/);
  });
});

describe("checkRateLimit", () => {
  const noStoreError = () => {
    throw new Error("store error not expected");
  };

  it("passes the rule from RATE_LIMITS to the store", async () => {
    const hit = vi.fn().mockResolvedValue({ allowed: true, hits: 1, retryAfterSeconds: 0 });
    await checkRateLimit("advice", null, headers("203.0.113.7"), noStoreError, hit);
    expect(hit).toHaveBeenCalledWith(expect.stringMatching(/^advice:ip:/), 60, 60);
    expect(RATE_LIMITS.role).toEqual({ limit: 5, windowSeconds: 3600, per: "user" });
  });

  it("throws a 429 with the wait time when over the limit", async () => {
    const hit = vi.fn().mockResolvedValue({ allowed: false, hits: 61, retryAfterSeconds: 42 });
    const error = await checkRateLimit("advice", null, headers(), noStoreError, hit).catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(42);
  });

  it("lets the request through and reports it when the store fails", async () => {
    const hit = vi.fn().mockRejectedValue(new Error("database down"));
    const onStoreError = vi.fn();
    await expect(checkRateLimit("advice", null, headers(), onStoreError, hit)).resolves.toBeUndefined();
    expect(onStoreError).toHaveBeenCalledOnce();
  });
});
