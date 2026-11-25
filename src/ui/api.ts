"use client";

import { useCallback, useEffect, useState } from "react";

// Small fetch helper for screens that read our own API. Lists come back as
// { data, meta }; errors as problem+json, which we only need the status of.
export type ApiList<T, M = Record<string, unknown>> = { data: T[]; meta: M };

export class ApiFetchError extends Error {
  constructor(public status: number) {
    super(`API ${status}`);
  }
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new ApiFetchError(res.status);
  reportFreshness(res);
  return (await res.json()) as T;
}

// The service worker marks a copy from its cache with X-RG-Cached-At
// (public/sw.js). The offline banner listens for these events to say how old
// the data on screen is.
export type CachedEvent = CustomEvent<{ savedAt: string }>;
function reportFreshness(res: Response) {
  if (typeof window === "undefined") return;
  const savedAt = res.headers.get("X-RG-Cached-At");
  window.dispatchEvent(savedAt ? new CustomEvent("rg:cached", { detail: { savedAt } }) : new Event("rg:fresh"));
}

export type Loaded<T> =
  | { state: "loading" }
  | { state: "error"; status: number }
  | { state: "ready"; value: T };

// Loads `path` once (and again on retry()). Offline caching is the service
// worker's job, not this hook's.
// The second item reloads and shows "loading" meanwhile; the third reloads
// quietly, keeping what is on screen until the new answer arrives.
export function useApi<T>(path: string): [Loaded<T>, () => void, () => void] {
  const [result, setResult] = useState<Loaded<T>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getJson<T>(path, controller.signal).then(
      (value) => setResult({ state: "ready", value }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ state: "error", status: error instanceof ApiFetchError ? error.status : 0 });
      },
    );
    return () => controller.abort();
  }, [path, attempt]);

  const retry = useCallback(() => {
    setResult({ state: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  return [result, retry, refresh];
}

// For admin forms: sends JSON and returns the status, the data on success,
// and the field paths the server marked as wrong (problem+json "errors").
// Network failures come back as status 0. The browser adds our Origin
// header itself, which the API needs on writes (CSRF check).
export type SendResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; fields: string[] };

export async function sendJson<T>(method: "POST" | "PATCH" | "DELETE", path: string, body: unknown): Promise<SendResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, fields: [] };
  }
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: { path: string }[] } | null;
  if (res.ok) return { ok: true, status: res.status, data: json?.data as T };
  return { ok: false, status: res.status, fields: (json?.errors ?? []).map((e) => e.path) };
}
