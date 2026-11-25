"use client";

import { RealtimeClient } from "@supabase/realtime-js";
import { useEffect, useRef } from "react";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createReloader, type Clock } from "./map-signal";

const clock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
};

// Keeps the map's road reports and police/TCU updates fresh. The database
// broadcasts a data-free "changed" on the public Realtime topic "map" after
// any write to reports or official updates (migration
// 20261125230000_map_live_signal.sql); the rows always come from our API.
// Without Realtime (no Supabase settings, blocked socket, offline) the map
// still reloads every minute while it is on screen.
export function useMapSignal(reload: () => void): void {
  const latest = useRef(reload);
  useEffect(() => {
    latest.current = reload;
  }, [reload]);

  useEffect(() => {
    const reloader = createReloader(() => latest.current(), clock);
    const visible = () => document.visibilityState === "visible";
    const every = window.setInterval(() => reloader.tick(visible()), 5_000);
    const onShow = () => {
      if (visible()) reloader.shown();
    };
    document.addEventListener("visibilitychange", onShow);

    const env = getSupabasePublicEnv();
    let realtime: RealtimeClient | null = null;
    if (env) {
      realtime = new RealtimeClient(`${env.url}/realtime/v1`, { params: { apikey: env.key } });
      realtime.channel("map").on("broadcast", { event: "changed" }, () => reloader.signal()).subscribe();
    }

    return () => {
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", onShow);
      reloader.stop();
      if (realtime) {
        const rt = realtime;
        void rt.removeAllChannels().finally(() => rt.disconnect());
      }
    };
  }, []);
}
