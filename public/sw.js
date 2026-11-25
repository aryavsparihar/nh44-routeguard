/* RouteGuard service worker (BUILD_PROMPT section 13). Written by hand, no
 * build step, so what you read here is what runs. docs/offline.md explains
 * the same policy in words.
 *
 * WHAT IS CACHED, AND HOW
 *
 * 1. Cache first: /_next/static/* (file names carry a content hash, so a
 *    copy never goes stale), our fonts, icons and the manifest.
 * 2. Network first, then the last good copy: the public pages listed in
 *    SHELL_PAGES, and the public GET endpoints in CACHED_API. A copy from the
 *    cache carries an "X-RG-Cached-At" header, so the page can say how old
 *    it is.
 * 3. Map tiles from tiles.openfreemap.org: cache first, only tiles that
 *    touch the NH-44 corridor box, at most MAX_TILES of them (oldest out
 *    first). The map style, sprites and fonts: network first.
 * 4. Network only, never stored: every other path. That includes everything
 *    that needs a sign-in (/api/v1/me, /shipments, /agents, /admin, /verify,
 *    and the pages in NEVER_CACHE_PAGES), every write (POST, PATCH, DELETE),
 *    and any API response marked Cache-Control private or no-store.
 *
 * Private data (your own lots and board) is never in these caches. The
 * page keeps it in IndexedDB under your user id, and signing out wipes it
 * (src/ui/offline/private-store.ts). Reports written with no signal wait in
 * an IndexedDB outbox, not here.
 *
 * UPDATES
 *
 * A new version installs in the background and waits. The page shows "New
 * version ready. Reload"; only that button sends SKIP_WAITING. We never
 * call skipWaiting() on our own, so a page is never switched to new code
 * halfway through.
 */

"use strict";

// The deploy's version, from the registration URL (/sw.js?v=...). A new
// version means a new install, new cache names, and old caches removed.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";

const CACHES = {
  static: `rg-static-${VERSION}`,
  pages: `rg-pages-${VERSION}`,
  api: `rg-api-${VERSION}`,
  tiles: "rg-tiles-v1", // tiles don't change with our deploys
  map: "rg-map-v1",
};

// Public pages worth having offline. None of them shows anything about
// the person looking at it.
const SHELL_PAGES = ["/", "/advisor", "/strip", "/status", "/privacy"];

// Pages that need a sign-in (src/server/auth/protected-pages.ts, checked by
// a test) and the sign-in page itself: never stored.
const NEVER_CACHE_PAGES = ["/board", "/report/new", "/me", "/admin", "/sign-in"];

// Public GET endpoints kept for offline use. All send Cache-Control public.
const CACHED_API = [
  "/api/v1/risk",
  "/api/v1/risk/summary",
  "/api/v1/zones",
  "/api/v1/official-updates",
  "/api/v1/incidents",
  "/api/v1/road-status",
  "/api/v1/reports",
  "/api/v1/model",
];

const OFFLINE_PAGE = "/offline.html";
const PRECACHE_STATIC = [OFFLINE_PAGE, "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png"];

const TILE_HOST = "tiles.openfreemap.org";
const MAX_TILES = 300;
// The corridor box of src/server/schemas/common.ts (BUILD_PROMPT section 6).
const CORRIDOR = { south: 32.6, north: 34.2, west: 74.7, east: 75.4 };

const CACHED_AT = "X-RG-Cached-At";

// ---------------------------------------------------------------------------
// Policy (pure functions; src/ui/offline/sw-policy.test.ts runs them)

function matchesPath(pathname, list) {
  return list.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)));
}

// Which strategy a request gets: "static", "page", "api", "tile", "map" or
// "network" (not touched).
function classify(request) {
  if (request.method !== "GET") return "network";
  const url = new URL(request.url);

  if (url.hostname === TILE_HOST) {
    return url.pathname.endsWith(".pbf") && /\/\d+\/\d+\/\d+\.pbf$/.test(url.pathname)
      ? tileInCorridor(url.pathname)
        ? "tile"
        : "network"
      : "map";
  }
  if (url.origin !== self.location.origin) return "network";

  // Next's client-side navigation and prefetch payloads vary by request
  // headers; leave them to the network. When they fail, Next loads the page
  // the normal way, which the "page" rule below answers.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return "network";

  if (url.pathname.startsWith("/_next/static/")) return "static";
  if (PRECACHE_STATIC.includes(url.pathname)) return "static";
  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/vendor/")) return "static";

  if (url.pathname.startsWith("/api/")) {
    return CACHED_API.includes(url.pathname) ? "api" : "network";
  }
  if (request.mode === "navigate") {
    if (matchesPath(url.pathname, NEVER_CACHE_PAGES)) return "network";
    if (SHELL_PAGES.includes(url.pathname)) return "page";
  }
  return "network";
}

// An API response we may store: a full 200 whose Cache-Control allows it.
function cacheableResponse(response) {
  if (!response || response.status !== 200 || response.type === "opaque") return false;
  const cc = (response.headers.get("Cache-Control") || "").toLowerCase();
  return !/\b(private|no-store)\b/.test(cc);
}

// A page we may store: a full HTML 200 that wasn't a redirect (to sign-in,
// say). Next marks streamed pages "private, no-store" by default, which says
// nothing about who may see them: SHELL_PAGES show the same thing to
// everyone, so that header isn't used here.
function cacheablePage(response) {
  if (!response || response.status !== 200 || response.redirected) return false;
  return (response.headers.get("Content-Type") || "").startsWith("text/html");
}

// Slippy-map tile z/x/y → does it touch the corridor box?
function tileInCorridor(pathname) {
  const m = pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
  if (!m) return false;
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  const n = 2 ** z;
  const lng = (i) => (i / n) * 360 - 180;
  const lat = (j) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * j) / n))) * 180) / Math.PI;
  const west = lng(x);
  const east = lng(x + 1);
  const north = lat(y);
  const south = lat(y + 1);
  return east >= CORRIDOR.west && west <= CORRIDOR.east && north >= CORRIDOR.south && south <= CORRIDOR.north;
}

self.RG_SW = { classify, cacheableResponse, cacheablePage, tileInCorridor, SHELL_PAGES, NEVER_CACHE_PAGES, CACHED_API, CACHES };

// ---------------------------------------------------------------------------
// Strategies

async function put(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT, new Date().toISOString());
  await cache.put(request, new Response(await response.blob(), { status: response.status, headers }));
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request, { cacheName });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

// Network first. On failure, the last good copy, marked with its age; with
// no copy either, `fallback()` or the network error.
async function networkFirst(request, cacheName, okToStore, fallback) {
  try {
    const response = await fetch(request);
    if (okToStore(response)) await put(cacheName, request, response.clone());
    return response;
  } catch (error) {
    const hit = await caches.match(request, { cacheName, ignoreVary: true });
    if (hit) return hit; // carries X-RG-Cached-At from put()
    if (fallback) {
      const page = await fallback();
      if (page) return page;
    }
    throw error;
  }
}

async function tile(request) {
  const hit = await caches.match(request, { cacheName: CACHES.tiles });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHES.tiles);
    await cache.put(request, response.clone());
    const keys = await cache.keys(); // in the order they were added
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await cache.delete(old);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  switch (classify(request)) {
    case "static":
      event.respondWith(cacheFirst(request, CACHES.static));
      return;
    case "page":
      event.respondWith(
        networkFirst(request, CACHES.pages, cacheablePage, () => caches.match(OFFLINE_PAGE, { cacheName: CACHES.static })),
      );
      return;
    case "api":
      event.respondWith(networkFirst(request, CACHES.api, cacheableResponse));
      return;
    case "tile":
      event.respondWith(tile(request));
      return;
    case "map":
      event.respondWith(networkFirst(request, CACHES.map, (r) => r.ok));
      return;
    default:
      // Network only. A page that needs a sign-in gets the offline page
      // when there is no signal at all.
      if (request.mode === "navigate") {
        event.respondWith(
          fetch(request).catch(async () => {
            const page = await caches.match(OFFLINE_PAGE, { cacheName: CACHES.static });
            if (page) return page;
            throw new TypeError("offline");
          }),
        );
      }
  }
});

// ---------------------------------------------------------------------------
// Lifecycle

// The shell pages, the files they load, and the offline page. One failure
// doesn't stop the install: whatever arrived is kept.
async function precache() {
  const statics = await caches.open(CACHES.static);
  await Promise.allSettled(PRECACHE_STATIC.map((path) => statics.add(path)));
  const assets = new Set();
  await Promise.allSettled(
    SHELL_PAGES.map(async (path) => {
      const response = await fetch(path, { credentials: "same-origin" });
      if (!cacheablePage(response)) return;
      const html = await response.clone().text();
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0]);
      await put(CACHES.pages, new Request(path), response);
    }),
  );
  await Promise.allSettled([...assets].map((path) => statics.add(path)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  const keep = new Set(Object.values(CACHES));
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("rg-") && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (type === "CLEAR_CACHES") {
    // Sign-out: drop every copy, then let the next visit fill them again.
    event.waitUntil(
      (async () => {
        for (const name of await caches.keys()) if (name.startsWith("rg-")) await caches.delete(name);
      })(),
    );
  }
});

// ---------------------------------------------------------------------------
// Push (Web Push alerts, BUILD_PROMPT P1). The server sends JSON:
// { title, body, url }. Only our own paths are opened on a tap.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RouteGuard", body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title.slice(0, 120) : "RouteGuard";
  const body = typeof data.body === "string" ? data.body.slice(0, 300) : "";
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag.slice(0, 64) : undefined,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === url.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url.href);
          return;
        }
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
