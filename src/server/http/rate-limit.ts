import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { Caller } from "./caller";
import { RateLimitError } from "./errors";
import { hitBucket, type Hit } from "./rate-limit.store";

// Shared rate limits (BUILD_PROMPT section 10), counted in Postgres so they
// hold across every app instance (section 17). withApi() calls check() for
// routes that name a limit:
//
//   export const POST = withApi({ access: "public", rateLimit: "advice" }, ...)
//
// Over the limit → 429 problem+json with Retry-After.
export const RATE_LIMITS = {
  advice: { limit: 60, windowSeconds: 60, per: "ip" }, // 60 a minute per IP
  report: { limit: 10, windowSeconds: 3600, per: "user" }, // 10 reports an hour
  confirmation: { limit: 30, windowSeconds: 3600, per: "user" }, // 30 confirmations an hour
  role: { limit: 5, windowSeconds: 3600, per: "user" }, // 5 role attempts an hour
  verification: { limit: 5, windowSeconds: 3600, per: "user" }, // 5 verification attempts an hour
} as const satisfies Record<string, { limit: number; windowSeconds: number; per: "ip" | "user" }>;

export type RateLimitName = keyof typeof RATE_LIMITS;

// The client's IP. On Azure Container Apps the ingress puts it first in
// X-Forwarded-For; we read that entry and nothing else (section 10). Anything
// that doesn't look like an IPv4 or IPv6 address counts as "unknown".
export function clientIp(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return /^[0-9A-Fa-f:.]{2,45}$/.test(first) ? first : "unknown";
}

// IPs are personal data, so the bucket holds a keyed hash, not the address.
// The key is derived from a server secret we already have; without one (CI,
// a fresh clone) a plain hash is enough, since nothing real is stored there.
function ipKey(ip: string): string {
  const secret = process.env.CLERK_SECRET_KEY;
  const digest = secret
    ? createHmac("sha256", secret).update(`rate-limit:${ip}`).digest("hex")
    : createHash("sha256").update(`rate-limit:${ip}`).digest("hex");
  return digest.slice(0, 32);
}

export function bucketFor(name: RateLimitName, caller: Caller | null, headers: Headers): string {
  const rule = RATE_LIMITS[name];
  if (rule.per === "user" && caller) return `${name}:user:${caller.userId}`;
  return `${name}:ip:${ipKey(clientIp(headers))}`;
}

// Throws RateLimitError when the caller is over the limit. If the store
// itself fails (database down), the request goes through and we log a
// warning: a broken counter shouldn't take the app down with it, and every
// write behind a limit needs the same database anyway.
export async function checkRateLimit(
  name: RateLimitName,
  caller: Caller | null,
  headers: Headers,
  onStoreError: (err: unknown) => void,
  hit: typeof hitBucket = hitBucket,
): Promise<void> {
  const rule = RATE_LIMITS[name];
  let result: Hit;
  try {
    result = await hit(bucketFor(name, caller, headers), rule.limit, rule.windowSeconds);
  } catch (err) {
    onStoreError(err);
    return;
  }
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}
