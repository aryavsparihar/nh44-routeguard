"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/src/i18n/routing";
import { formatTime, isolate } from "@/src/shared/format";
import type { CachedEvent } from "@/src/ui/api";
import { SignInLink } from "@/src/ui/SignInLink";
import { ageText } from "./age";
import { sendOutbox } from "./outbox";
import { useNow, useOnline } from "./useNow";

// How often to try the outbox again while reports wait and the phone says
// it is online (a weak signal doesn't fire the "online" event again).
const RETRY_MS = 60_000;

type Queue = { waiting: number; sent: number; dropped: number; signedOut: boolean };

// One strip under the header for everything offline (BUILD_PROMPT section
// 13): registers the service worker, offers "New version ready. Reload",
// says when the data on screen is a saved copy and how old it is, and sends
// reports that waited in the outbox ("2 reports waiting to send").
export function OfflineStatus({ version, register }: { version: string; register: boolean }) {
  const t = useTranslations("offline");
  const locale = useLocale() as Locale;
  const online = useOnline();
  const now = useNow();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [queue, setQueue] = useState<Queue>({ waiting: 0, sent: 0, dropped: 0, signedOut: false });
  const reloading = useRef(false);

  // Whether the last data came from the service worker's cache.
  useEffect(() => {
    const cached = (e: Event) => setSavedAt((e as CachedEvent).detail.savedAt);
    const fresh = () => setSavedAt(null);
    window.addEventListener("rg:cached", cached);
    window.addEventListener("rg:fresh", fresh);
    return () => {
      window.removeEventListener("rg:cached", cached);
      window.removeEventListener("rg:fresh", fresh);
    };
  }, []);

  // The service worker. Only in production builds: in `next dev` a worker
  // would serve old code, so any left from a production run is removed.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    if (!register) {
      void sw.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
      return;
    }
    const watch = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && sw.controller) setUpdate(worker);
      });
    };
    sw.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" }).then(
      (reg) => {
        if (reg.waiting && sw.controller) setUpdate(reg.waiting);
        watch(reg.installing);
        reg.addEventListener("updatefound", () => watch(reg.installing));
      },
      () => {}, // no worker: the app still works online
    );
    const changed = () => {
      if (reloading.current) window.location.reload();
    };
    sw.addEventListener("controllerchange", changed);
    return () => sw.removeEventListener("controllerchange", changed);
  }, [register, version]);

  // The outbox: on open, when back online, when a report is queued, and
  // every minute while some wait.
  const sync = useCallback(() => {
    void sendOutbox().then((r) =>
      setQueue((old) => ({
        waiting: r.waiting,
        sent: old.sent + r.sent,
        dropped: old.dropped + r.dropped,
        signedOut: r.signedOut,
      })),
    );
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("rg:outbox", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("rg:outbox", sync);
    };
  }, [sync]);

  useEffect(() => {
    if (queue.waiting === 0) return;
    const timer = setInterval(sync, RETRY_MS);
    return () => clearInterval(timer);
  }, [queue.waiting, sync]);

  function reload() {
    reloading.current = true;
    update?.postMessage({ type: "SKIP_WAITING" });
  }

  const lines: ReactNode[] = [];
  if (update) {
    lines.push(
      <p key="update" className="flex flex-wrap items-center gap-2">
        {t("update")}
        <button type="button" className="min-h-10 rounded-md bg-primary px-3 font-bold text-inverse" onClick={reload}>
          {t("reload")}
        </button>
      </p>,
    );
  }
  if (!online || savedAt) {
    const when = savedAt ? new Date(savedAt) : null;
    const age = when && now > 0 ? ageText(t, now - when.getTime()) : null;
    lines.push(
      <p key="offline">
        {online ? t("unreachable") : t("offline")}{" "}
        {when && age
          ? t("savedAt", { time: isolate(formatTime(when, locale)), age })
          : !online
            ? t("savedNone")
            : null}
      </p>,
    );
  }
  if (queue.waiting > 0) {
    lines.push(
      <p key="queue" className="flex flex-wrap items-center gap-2">
        {t("waiting", { count: queue.waiting })}
        {queue.signedOut ? (
          <SignInLink href="/me" className="font-bold underline">
            {t("signInToSend")}
          </SignInLink>
        ) : (
          <button type="button" className="min-h-10 font-bold underline" onClick={sync}>
            {t("sendNow")}
          </button>
        )}
      </p>,
    );
  }
  if (queue.sent > 0 && queue.waiting === 0) lines.push(<p key="sent">{t("sent", { count: queue.sent })}</p>);
  if (queue.dropped > 0) lines.push(<p key="dropped">{t("dropped", { count: queue.dropped })}</p>);

  if (lines.length === 0) return null;
  return (
    <div role="status" className="border-b border-border-strong bg-surface px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-2xl flex-col gap-1">{lines}</div>
    </div>
  );
}
