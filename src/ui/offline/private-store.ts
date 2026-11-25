"use client";

import { idb, idbAvailable } from "./idb";

// This person's own data (their board, their lots) saved on the phone so the
// board still shows something with no signal. Every entry carries the user
// id it belongs to and is only read back for that same id. The service
// worker never stores these (public/sw.js); signing out wipes them.

type Entry<T> = { key: string; userId: string; savedAt: string; value: T };

const keyFor = (userId: string, name: string) => `${userId}:${name}`;

export async function savePrivate<T>(userId: string, name: string, value: T): Promise<void> {
  if (!idbAvailable()) return;
  const entry: Entry<T> = { key: keyFor(userId, name), userId, savedAt: new Date().toISOString(), value };
  await idb.put("private", entry).catch(() => {});
}

export async function loadPrivate<T>(userId: string, name: string): Promise<{ value: T; savedAt: string } | null> {
  if (!idbAvailable()) return null;
  const entry = await idb.get<Entry<T>>("private", keyFor(userId, name)).catch(() => undefined);
  if (!entry || entry.userId !== userId) return null;
  return { value: entry.value, savedAt: entry.savedAt };
}

// Sign-out (and account deletion): the outbox, the private store and every
// cache the service worker keeps. Nothing from this person stays behind for
// the next one to sign in on this phone.
export async function clearOfflineData(): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  if (idbAvailable()) {
    jobs.push(idb.clear("outbox").catch(() => {}), idb.clear("private").catch(() => {}));
  }
  if (typeof caches !== "undefined") {
    jobs.push(
      caches
        .keys()
        .then((names) => Promise.all(names.filter((n) => n.startsWith("rg-")).map((n) => caches.delete(n))))
        .catch(() => {}),
    );
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_CACHES" });
  await Promise.all(jobs);
  window.dispatchEvent(new Event("rg:outbox"));
}
