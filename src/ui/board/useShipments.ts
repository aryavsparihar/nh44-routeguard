"use client";

import { RealtimeClient } from "@supabase/realtime-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { Shipment } from "@/src/shared/api-types";
import { ApiFetchError, getJson, type ApiList, type Loaded } from "@/src/ui/api";
import { loadPrivate, savePrivate } from "@/src/ui/offline/private-store";

export type Live = "connecting" | "live" | "off";

// The shipments on this person's board, kept fresh. The rows always come from
// our API (GET /api/v1/shipments). Supabase Realtime only says "something
// changed"; it runs with the person's own Clerk token (from
// /api/v1/me/realtime-token, asked again on every heartbeat), so RLS sends
// them changes to their own shipments only. A change makes us load the list again
// (at most once a second). Without Realtime the list still works: it reloads
// every 60 seconds and on "Reload".
//
// Each good list is also saved on the phone under this person's user id
// (src/ui/offline/private-store.ts). With no signal the board shows that
// copy and when it was saved (`savedAt`); signing out wipes it.
export function useShipments(userId: string): {
  list: Loaded<Shipment[]>;
  live: Live;
  savedAt: string | null;
  reload: () => void;
} {
  const [list, setList] = useState<Loaded<Shipment[]>>({ state: "loading" });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [live, setLive] = useState<Live>(() => (getSupabasePublicEnv() ? "connecting" : "off"));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await getJson<ApiList<Shipment>>("/api/v1/shipments?limit=100");
      setList({ state: "ready", value: body.data });
      setSavedAt(null);
      void savePrivate(userId, "shipments", body.data);
    } catch (error) {
      const status = error instanceof ApiFetchError ? error.status : 0;
      // No signal (status 0): the copy saved on this phone, if there is one.
      const copy = status === 0 ? await loadPrivate<Shipment[]>(userId, "shipments") : null;
      setList((old) => {
        if (old.state === "ready") return old;
        return copy ? { state: "ready", value: copy.value } : { state: "error", status };
      });
      if (copy) setSavedAt((old) => old ?? copy.savedAt);
    }
  }, [userId]);

  const reload = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void load();
    }, 1000);
  }, [load]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const every = setInterval(() => void load(), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [load]);

  useEffect(() => {
    const env = getSupabasePublicEnv();
    if (!env) return; // no Realtime: `live` started as "off"
    const realtime = new RealtimeClient(`${env.url}/realtime/v1`, {
      params: { apikey: env.key },
      accessToken: realtimeToken,
    });
    const channel = realtime
      .channel("board-shipments")
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, () => reload())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLive("off");
      });
    return () => {
      void realtime.removeChannel(channel).finally(() => realtime.disconnect());
    };
  }, [reload]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { list, live, savedAt, reload: () => void load() };
}

async function realtimeToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/v1/me/realtime-token", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return ((await res.json()) as { data: { token: string } }).data.token;
  } catch {
    return null;
  }
}

// JSON writes to our API. Returns the status and the parsed body (or null).
export async function send<T = unknown>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null; paths: string[] }> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { data?: T; errors?: { path: string }[] } | null;
    return { status: res.status, data: res.ok ? (json?.data ?? null) : null, paths: (json?.errors ?? []).map((e) => e.path) };
  } catch {
    return { status: 0, data: null, paths: [] };
  }
}
