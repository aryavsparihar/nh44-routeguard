#!/usr/bin/env node
// Post-deploy smoke test (BUILD_PROMPT section 21, A7). Plain Node 24, no
// dependencies. Checks a running app from the outside and exits 1 if
// anything is wrong.
//
//   node scripts/smoke.mjs https://<app>.azurecontainerapps.io
//   REQUIRE_READY=1 node scripts/smoke.mjs http://localhost:3000
//
// REQUIRE_READY=1: /api/v1/health/ready must be 200 (the database answers).
// Without it (CI, where the image has no keys), a 503 problem+json is fine.
// Old risk data only prints a warning: the app still works, it shows the
// stale banner.
//
// It sends no keys or tokens and prints no response bodies.

const base = process.argv[2]?.replace(/\/+$/, "");
if (!base || !/^https?:\/\//.test(base)) {
  console.error("Usage: node scripts/smoke.mjs <base-url>   e.g. http://localhost:3000");
  process.exit(2);
}
const requireReady = process.env.REQUIRE_READY === "1";
const TIMEOUT_MS = 15_000; // a scaled-to-zero app needs a few seconds to start

let failures = 0;
const pass = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`✗ ${msg}`);
};
const warn = (msg) => console.log(`! ${msg}`);

async function request(path, init = {}) {
  return fetch(`${base}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
  });
}

const isProblem = (res) => (res.headers.get("content-type") ?? "").includes("application/problem+json");

async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Smoke test: ${base}${requireReady ? " (database required)" : ""}`);

await check("GET /api/v1/health", async () => {
  const res = await request("/api/v1/health");
  const body = await res.json().catch(() => null);
  if (res.status === 200 && body?.data?.status === "ok") pass("GET /api/v1/health is 200 ok");
  else fail(`GET /api/v1/health: expected 200 ok, got ${res.status}`);
  if (res.headers.get("x-request-id")) pass("responses carry X-Request-Id");
  else fail("X-Request-Id header missing");

  // Security headers (next.config.ts) apply to every path, API included.
  for (const name of ["content-security-policy", "strict-transport-security", "x-content-type-options"]) {
    if (res.headers.get(name)) pass(`${name} header present`);
    else fail(`${name} header missing`);
  }
  if (res.headers.get("x-powered-by")) fail("X-Powered-By header should not be sent");
  else pass("no X-Powered-By header");
});

await check("GET /api/v1/health/ready", async () => {
  const res = await request("/api/v1/health/ready");
  const body = await res.json().catch(() => null);
  if (res.status === 200 && body?.data?.database === "ok") {
    const d = body.data;
    pass(`GET /api/v1/health/ready is 200 (data ${d.data_age_minutes ?? "never"} min old)`);
    if (d.stale) warn(`risk data is stale (over ${d.stale_after_minutes} min old): check the risk job`);
  } else if (res.status === 503 && isProblem(res) && !requireReady) {
    pass("GET /api/v1/health/ready is 503 problem+json (no database here, allowed)");
  } else {
    fail(`GET /api/v1/health/ready: expected 200${requireReady ? "" : " or 503"}, got ${res.status}`);
  }
});

await check("GET /api/v1/risk", async () => {
  const res = await request("/api/v1/risk");
  if (res.status === 200) {
    const etag = res.headers.get("etag");
    pass("GET /api/v1/risk is 200");
    if (!etag) return fail("GET /api/v1/risk sent no ETag");
    const again = await request("/api/v1/risk", { headers: { "if-none-match": etag } });
    if (again.status === 304) pass("GET /api/v1/risk with its ETag is 304");
    else fail(`GET /api/v1/risk with its ETag: expected 304, got ${again.status}`);
  } else if (res.status === 503 && isProblem(res) && !requireReady) {
    pass("GET /api/v1/risk is 503 problem+json (no database here, allowed)");
  } else {
    fail(`GET /api/v1/risk: expected 200${requireReady ? "" : " or 503"}, got ${res.status}`);
  }
});

await check("GET /", async () => {
  const res = await request("/");
  // 307 is Clerk's development-instance handshake on a first page visit.
  if (res.status === 200 || res.status === 307) pass(`GET / answers ${res.status}`);
  else fail(`GET /: expected 200, got ${res.status}`);
});

await check("GET /api/v1/me signed out", async () => {
  const res = await request("/api/v1/me");
  if (res.status === 401 && isProblem(res)) pass("GET /api/v1/me signed out is 401 problem+json");
  else fail(`GET /api/v1/me: expected 401 problem+json, got ${res.status}`);
});

await check("GET unknown API path", async () => {
  const res = await request("/api/v1/smoke-test-no-such-route");
  if (res.status === 404 && isProblem(res)) pass("unknown API path is 404 problem+json");
  else fail(`unknown API path: expected 404 problem+json, got ${res.status}`);
});

await check("POST /api/v1/health", async () => {
  const res = await request("/api/v1/health", { method: "POST" });
  if (res.status === 405 && res.headers.get("allow")) pass(`POST /api/v1/health is 405 (Allow: ${res.headers.get("allow")})`);
  else fail(`POST /api/v1/health: expected 405 with Allow, got ${res.status}`);
});

console.log(failures === 0 ? "Smoke test passed." : `Smoke test failed: ${failures} problem(s).`);
process.exit(failures === 0 ? 0 : 1);
