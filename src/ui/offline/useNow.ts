"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// The current time, refreshed every `everyMs`, for "12 minutes old" texts.
// 0 until the page runs in the browser: the static shell is prerendered, so
// the clock can't be read while rendering.
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [everyMs]);
  return now;
}

// navigator.onLine, kept current by the online/offline events. The server
// render assumes online.
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
