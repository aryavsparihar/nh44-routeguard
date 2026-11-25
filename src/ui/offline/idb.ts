"use client";

// A small promise wrapper around IndexedDB for the "routeguard" database.
// Two stores:
//   outbox  : reports written with no signal, waiting to be sent (outbox.ts)
//   private : this person's own data saved for offline use, under their
//             user id (private-store.ts)
// Signing out empties both (clearOfflineData in private-store.ts).

const DB_NAME = "routeguard";
const DB_VERSION = 1;
export type StoreName = "outbox" | "private";

let opening: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      if (!db.objectStoreNames.contains("private")) db.createObjectStore("private", { keyPath: "key" });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading the database: let go so it can.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  all: <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll()),
  put: <T>(store: StoreName, value: T) => run(store, "readwrite", (s) => s.put(value)).then(() => undefined),
  delete: (store: StoreName, key: string) => run(store, "readwrite", (s) => s.delete(key)).then(() => undefined),
  clear: (store: StoreName) => run(store, "readwrite", (s) => s.clear()).then(() => undefined),
};
