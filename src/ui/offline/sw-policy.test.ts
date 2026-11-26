// The service worker's caching rules (public/sw.js), run in a sandbox with
// a fake `self`. The worker is plain JavaScript with no build step, so these
// tests are what keeps its lists in line with the rest of the app.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { PROTECTED_PAGES, isProtectedPage } from "@/src/server/auth/protected-pages";

type FakeRequest = { method: string; url: string; mode: string; headers: Headers };
type Policy = {
  classify(r: FakeRequest): string;
  cacheableResponse(r: Response): boolean;
  cacheablePage(r: Response): boolean;
  tileInCorridor(pathname: string): boolean;
  SHELL_PAGES: string[];
  NEVER_CACHE_PAGES: string[];
  CACHED_API: string[];
  CACHES: Record<string, string>;
};

const ORIGIN = "https://routeguard.test";

function loadWorker(version = "abc123"): { policy: Policy; events: string[] } {
  const events: string[] = [];
  const self: Record<string, unknown> = {
    location: { href: `${ORIGIN}/sw.js?v=${version}`, origin: ORIGIN },
    addEventListener: (name: string) => events.push(name),
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL, Request, Response, Headers });
  return { policy: self.RG_SW as Policy, events };
}

const { policy, events } = loadWorker();

function req(path: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}): FakeRequest {
  return {
    method: init.method ?? "GET",
    url: path.startsWith("http") ? path : `${ORIGIN}${path}`,
    mode: init.mode ?? "cors",
    headers: new Headers(init.headers),
  };
}
const nav = (path: string) => req(path, { mode: "navigate" });

// Slippy-map tile numbers for a point.
function tileAt(lat: number, lng: number, z: number): string {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return `/planet/20261101_001001_pt/${z}/${x}/${y}.pbf`;
}

describe("service worker policy", () => {
  it("handles install, activate, fetch, message, push and notification clicks", () => {
    expect(events).toEqual(expect.arrayContaining(["install", "activate", "fetch", "message", "push", "notificationclick"]));
  });

  it("names its caches after the deploy version from its URL", () => {
    expect(policy.CACHES.static).toBe("rg-static-abc123");
    expect(policy.CACHES.api).toBe("rg-api-abc123");
    expect(loadWorker("next").policy.CACHES.pages).toBe("rg-pages-next");
  });

  it("serves hashed build files and icons cache first", () => {
    expect(policy.classify(req("/_next/static/chunks/app-1a2b.js"))).toBe("static");
    expect(policy.classify(req("/icons/icon-192.png"))).toBe("static");
    expect(policy.classify(req("/manifest.webmanifest"))).toBe("static");
  });

  it("keeps the public pages, network first", () => {
    for (const page of ["/", "/advisor", "/strip", "/status", "/privacy"]) expect(policy.classify(nav(page))).toBe("page");
  });

  it("never stores a page that needs a sign-in, or the sign-in page", () => {
    for (const page of [...PROTECTED_PAGES, "/admin/users", "/board/x", "/sign-in", "/sign-in/factor-one"]) {
      expect(policy.classify(nav(page))).toBe("network");
    }
  });

  it("lists every protected page (src/server/auth/protected-pages.ts) as never cached", () => {
    for (const page of PROTECTED_PAGES) expect(policy.NEVER_CACHE_PAGES).toContain(page);
    for (const page of policy.SHELL_PAGES) expect(isProtectedPage(page)).toBe(false);
  });

  it("leaves Next's in-app navigation payloads to the network", () => {
    expect(policy.classify(req("/advisor?_rsc=abc"))).toBe("network");
    expect(policy.classify(req("/advisor", { headers: { RSC: "1" } }))).toBe("network");
  });

  it("keeps the public API reads, network first", () => {
    for (const path of ["/api/v1/risk", "/api/v1/risk?horizon=24", "/api/v1/risk/summary", "/api/v1/risk/hexes?horizon=12", "/api/v1/zones", "/api/v1/reports", "/api/v1/road-status"]) {
      expect(policy.classify(req(path))).toBe("api");
    }
  });

  it("never stores signed-in API paths or writes", () => {
    for (const path of ["/api/v1/me", "/api/v1/me/realtime-token", "/api/v1/shipments", "/api/v1/shipments/1", "/api/v1/agents/drivers", "/api/v1/admin/users", "/api/v1/verify/aadhaar", "/api/v1/advice"]) {
      expect(policy.classify(req(path))).toBe("network");
    }
    expect(policy.classify(req("/api/v1/reports", { method: "POST" }))).toBe("network");
    expect(policy.classify(req("/api/v1/risk", { method: "HEAD" }))).toBe("network");
  });

  it("caches only API routes that are public and send public Cache-Control", () => {
    for (const path of policy.CACHED_API) {
      const source = readFileSync(`app${path}/route.ts`, "utf8");
      expect(source, path).toMatch(/access: "public"/);
      expect(source, path).toMatch(/public, max-age|RISK_CACHE_CONTROL/);
    }
  });

  it("stores an API answer only when it is a 200 without private or no-store", () => {
    const res = (status: number, cc?: string) => new Response("{}", { status, headers: cc ? { "Cache-Control": cc } : {} });
    expect(policy.cacheableResponse(res(200, "public, max-age=60"))).toBe(true);
    expect(policy.cacheableResponse(res(200))).toBe(true);
    expect(policy.cacheableResponse(res(200, "no-store"))).toBe(false);
    expect(policy.cacheableResponse(res(200, "private, max-age=300"))).toBe(false);
    expect(policy.cacheableResponse(res(206, "public"))).toBe(false);
    expect(policy.cacheableResponse(res(503, "public"))).toBe(false);
  });

  it("stores a page only when it is HTML that didn't redirect", () => {
    const html = new Response("<p>", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    expect(policy.cacheablePage(html)).toBe(true);
    expect(policy.cacheablePage(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }))).toBe(false);
    expect(policy.cacheablePage(new Response("<p>", { status: 500, headers: { "Content-Type": "text/html" } }))).toBe(false);
    const redirected = new Response("<p>", { status: 200, headers: { "Content-Type": "text/html" } });
    Object.defineProperty(redirected, "redirected", { value: true });
    expect(policy.cacheablePage(redirected)).toBe(false);
  });

  it("keeps map tiles on the corridor only", () => {
    const tiles = "https://tiles.openfreemap.org";
    expect(policy.classify(req(`${tiles}${tileAt(33.4, 75.0, 10)}`))).toBe("tile"); // Banihal
    expect(policy.classify(req(`${tiles}${tileAt(34.08, 74.8, 13)}`))).toBe("tile"); // Srinagar
    expect(policy.classify(req(`${tiles}${tileAt(28.6, 77.2, 10)}`))).toBe("network"); // Delhi
    expect(policy.classify(req(`${tiles}${tileAt(32.6, 74.7, 2)}`))).toBe("tile"); // world view tile holds it
    expect(policy.classify(req(`${tiles}/styles/positron`))).toBe("map");
    expect(policy.classify(req(`${tiles}/fonts/Noto%20Sans%20Regular/0-255.pbf`))).toBe("map");
  });

  it("leaves other sites alone", () => {
    expect(policy.classify(req("https://clerk.example.com/v1/client"))).toBe("network");
    expect(policy.classify(req("https://abc.supabase.co/realtime/v1"))).toBe("network");
  });
});
