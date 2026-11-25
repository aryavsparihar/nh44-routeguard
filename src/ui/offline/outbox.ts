import rules from "@/config/report-rules.json";
import type { PublicReport } from "@/src/shared/api-types";
import { idb, idbAvailable } from "./idb";

// Reports written with no signal (BUILD_PROMPT section 13). Each waits in
// IndexedDB with the Idempotency-Key the form made for it, and is sent when
// the app opens and when the phone comes back online. The key makes a
// resend harmless: the server answers "repeat" instead of making a second
// report.

type Hazard = PublicReport["hazard_type"];

export type OutboxItem = {
  id: string; // the Idempotency-Key, a UUID
  userId: string; // who wrote it; only sent while they are signed in
  createdAt: string; // ISO time it was written on the phone
  hazard_type: Hazard;
  lat: string;
  lng: string;
  note?: string;
  photo?: Blob;
};

export type OutboxStore = {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  delete(id: string): Promise<void>;
};

export const browserOutbox: OutboxStore = {
  all: () => (idbAvailable() ? idb.all<OutboxItem>("outbox") : Promise.resolve([])),
  put: (item) => idb.put("outbox", item),
  delete: (id) => idb.delete("outbox", id),
};

export type SyncResult = {
  sent: number; // reached the server now
  dropped: number; // removed without sending: too old, or refused for good
  waiting: number; // still on the phone
  signedOut: boolean; // waiting because nobody (or someone else) is signed in
};

// A report older than its hazard's expiry would leave the map the moment it
// arrived, so it isn't sent (config/report-rules.json).
export function tooOld(item: Pick<OutboxItem, "hazard_type" | "createdAt">, now: number): boolean {
  const hours = (rules.expiry_hours as Record<string, number>)[item.hazard_type] ?? 3;
  return now - Date.parse(item.createdAt) > hours * 3_600_000;
}

export function formFor(item: OutboxItem): FormData {
  const form = new FormData();
  form.set("hazard_type", item.hazard_type);
  form.set("lat", item.lat);
  form.set("lng", item.lng);
  if (item.note) form.set("note", item.note);
  if (item.photo) form.set("photo", item.photo, "photo.jpg");
  return form;
}

let running: Promise<SyncResult> | null = null;

// One send at a time per tab. Another tab sending the same report is safe
// (same Idempotency-Key).
export function sendOutbox(store: OutboxStore = browserOutbox, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<SyncResult> {
  running ??= send(store, fetchFn, now).finally(() => {
    running = null;
  });
  return running;
}

async function send(store: OutboxStore, fetchFn: typeof fetch, now: number): Promise<SyncResult> {
  const items = (await store.all().catch(() => [] as OutboxItem[])).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const result: SyncResult = { sent: 0, dropped: 0, waiting: items.length, signedOut: false };
  if (items.length === 0) return result;

  // Who is signed in now? Reports are only sent as the person who wrote them.
  let me: string;
  try {
    const res = await fetchFn("/api/v1/me", { cache: "no-store", headers: { Accept: "application/json" } });
    if (res.status === 401) return { ...result, signedOut: true };
    if (!res.ok) return result;
    me = ((await res.json()) as { data: { id: string } }).data.id;
  } catch {
    return result; // still offline
  }

  for (const item of items) {
    if (item.userId !== me) {
      // Written by someone who has since signed out on this phone. It can't
      // be sent as them any more.
      await store.delete(item.id);
      result.dropped++;
      result.waiting--;
      continue;
    }
    if (tooOld(item, now)) {
      await store.delete(item.id);
      result.dropped++;
      result.waiting--;
      continue;
    }
    let res: Response;
    try {
      res = await fetchFn("/api/v1/reports", {
        method: "POST",
        headers: { "Idempotency-Key": item.id, Accept: "application/json" },
        body: formFor(item),
      });
    } catch {
      return result; // signal gone again; try later
    }
    if (res.ok) {
      await store.delete(item.id);
      result.sent++;
      result.waiting--;
    } else if (res.status === 401) {
      return { ...result, signedOut: true };
    } else if (res.status === 429 || res.status >= 500) {
      return result; // busy or paused: try later
    } else {
      // 4xx: the server will never take this one (off the corridor, a role
      // that can't report, a used key). Sending it again won't help.
      await store.delete(item.id);
      result.dropped++;
      result.waiting--;
    }
  }
  return result;
}

export async function queueReport(item: OutboxItem, store: OutboxStore = browserOutbox): Promise<void> {
  await store.put(item);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rg:outbox"));
}

export async function outboxCount(store: OutboxStore = browserOutbox): Promise<number> {
  return (await store.all().catch(() => [])).length;
}
