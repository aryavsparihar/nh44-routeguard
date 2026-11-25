import { describe, expect, it, vi } from "vitest";
import { formFor, sendOutbox, tooOld, type OutboxItem, type OutboxStore } from "./outbox";

const NOW = Date.parse("2026-11-26T10:00:00Z");
const ME = "user_me";

function memoryStore(items: OutboxItem[]): OutboxStore & { items: Map<string, OutboxItem> } {
  const map = new Map(items.map((i) => [i.id, i]));
  return {
    items: map,
    all: async () => [...map.values()],
    put: async (i) => void map.set(i.id, i),
    delete: async (id) => void map.delete(id),
  };
}

function item(n: number, over: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    userId: ME,
    createdAt: new Date(NOW - (10 - n) * 60_000).toISOString(),
    hazard_type: "rockfall",
    lat: "33.400000",
    lng: "75.100000",
    ...over,
  };
}

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const meOk = () => json(200, { data: { id: ME } });

// A fetch that answers /api/v1/me with `me` and each report POST in turn.
function fakeFetch(me: () => Response | Promise<Response>, posts: (() => Response)[]) {
  const calls: { url: string; key: string | null }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, key: new Headers(init?.headers).get("Idempotency-Key") });
    if (u === "/api/v1/me") return me();
    const next = posts.shift();
    if (!next) throw new Error("unexpected POST");
    return next();
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe("report outbox", () => {
  it("does nothing when nothing waits", async () => {
    const f = fakeFetch(meOk, []);
    expect(await sendOutbox(memoryStore([]), f.fn, NOW)).toEqual({ sent: 0, dropped: 0, waiting: 0, signedOut: false });
    expect(f.calls).toHaveLength(0);
  });

  it("keeps everything while there is no signal", async () => {
    const store = memoryStore([item(1), item(2)]);
    const f = fakeFetch(() => Promise.reject(new TypeError("offline")), []);
    expect(await sendOutbox(store, f.fn, NOW)).toMatchObject({ sent: 0, waiting: 2 });
    expect(store.items.size).toBe(2);
  });

  it("keeps everything and says so when signed out", async () => {
    const store = memoryStore([item(1)]);
    expect(await sendOutbox(store, fakeFetch(() => json(401), []).fn, NOW)).toMatchObject({ waiting: 1, signedOut: true });
    expect(store.items.size).toBe(1);
  });

  it("sends the oldest first, each with its own Idempotency-Key, and removes what arrived", async () => {
    const store = memoryStore([item(2), item(1)]);
    const f = fakeFetch(meOk, [() => json(201), () => json(200)]);
    expect(await sendOutbox(store, f.fn, NOW)).toEqual({ sent: 2, dropped: 0, waiting: 0, signedOut: false });
    expect(f.calls.slice(1).map((c) => c.key)).toEqual([item(1).id, item(2).id]);
    expect(store.items.size).toBe(0);
  });

  it("drops a report written by someone else on this phone", async () => {
    const store = memoryStore([item(1, { userId: "user_other" }), item(2)]);
    const f = fakeFetch(meOk, [() => json(201)]);
    expect(await sendOutbox(store, f.fn, NOW)).toEqual({ sent: 1, dropped: 1, waiting: 0, signedOut: false });
    expect(f.calls).toHaveLength(2); // /me and one POST
  });

  it("drops a report older than its hazard's expiry without sending it", async () => {
    const old = item(1, { createdAt: new Date(NOW - 7 * 3_600_000).toISOString() }); // rockfall: 6 h
    const store = memoryStore([old]);
    const f = fakeFetch(meOk, []);
    expect(await sendOutbox(store, f.fn, NOW)).toMatchObject({ sent: 0, dropped: 1, waiting: 0 });
  });

  it("drops a report the server refuses for good (4xx), keeps one it can't take yet (429, 5xx)", async () => {
    const store = memoryStore([item(1), item(2), item(3)]);
    const f = fakeFetch(meOk, [() => json(422), () => json(503)]);
    expect(await sendOutbox(store, f.fn, NOW)).toEqual({ sent: 0, dropped: 1, waiting: 2, signedOut: false });
    expect([...store.items.keys()]).toEqual([item(2).id, item(3).id]);
  });

  it("stops when the signal drops halfway", async () => {
    const store = memoryStore([item(1), item(2)]);
    const f = fakeFetch(meOk, [
      () => json(201),
      () => {
        throw new TypeError("offline");
      },
    ]);
    expect(await sendOutbox(store, f.fn, NOW)).toMatchObject({ sent: 1, waiting: 1 });
    expect([...store.items.keys()]).toEqual([item(2).id]);
  });

  it("runs one send at a time", async () => {
    const store = memoryStore([item(1)]);
    const f = fakeFetch(meOk, [() => json(201)]);
    const [a, b] = await Promise.all([sendOutbox(store, f.fn, NOW), sendOutbox(store, f.fn, NOW)]);
    expect(a).toBe(b);
    expect(f.calls).toHaveLength(2);
  });

  it("builds the same form the report screen sends", () => {
    const form = formFor(item(1, { note: "Stones on the road", photo: new Blob(["x"], { type: "image/jpeg" }) }));
    expect(form.get("hazard_type")).toBe("rockfall");
    expect(form.get("lat")).toBe("33.400000");
    expect(form.get("note")).toBe("Stones on the road");
    expect((form.get("photo") as File).name).toBe("photo.jpg");
    expect(formFor(item(2)).has("photo")).toBe(false);
  });

  it("uses each hazard's expiry", () => {
    const at = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
    expect(tooOld({ hazard_type: "accident", createdAt: at(2.9) }, NOW)).toBe(false);
    expect(tooOld({ hazard_type: "accident", createdAt: at(3.1) }, NOW)).toBe(true);
    expect(tooOld({ hazard_type: "snow_ice", createdAt: at(11) }, NOW)).toBe(false);
  });
});
