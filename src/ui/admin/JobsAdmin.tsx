"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Locale } from "@/src/i18n/routing";
import { formatDayTime, isolate } from "@/src/shared/format";
import { getJson, type ApiList } from "@/src/ui/api";
import { Notice, quietButtonClass } from "./common";

type DeadLetter = {
  id: number;
  msg_id: number;
  job: string;
  payload: Record<string, unknown>;
  attempts: number;
  last_error: string | null;
  enqueued_at: string;
  failed_at: string;
};

// Read-only list of queue jobs that failed 5 times (job_dead_letters).
export function JobsAdmin() {
  const t = useTranslations("admin.jobs");
  const ta = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [before, setBefore] = useState<string | null>(null);
  const [rows, setRows] = useState<DeadLetter[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const query = before ? `?${new URLSearchParams({ cursor: before })}` : "";
    getJson<ApiList<DeadLetter, { next_cursor: string | null }>>(`/api/v1/admin/dead-letters${query}`, controller.signal).then(
      (page) => {
        setRows((old) => (before ? [...old, ...page.data] : page.data));
        setNext(page.meta.next_cursor);
        setState("ready");
      },
      () => {
        if (!controller.signal.aborted) setState("error");
      },
    );
    return () => controller.abort();
  }, [before]);

  const when = (iso: string) => formatDayTime(new Date(iso), locale);

  return (
    <div className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      {state === "loading" && <p role="status">{ta("loading")}</p>}
      {state === "error" && <Notice kind="error">{ta("err.load")}</Notice>}
      {state === "ready" && rows.length === 0 && <p className="text-sm text-secondary">{t("none")}</p>}
      <ol className="flex flex-col gap-2">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-col gap-1 rounded-lg border border-border bg-elevated p-3 text-sm">
            <p className="font-bold">
              <bdi className="font-mono">{d.job}</bdi> · {t("attempts", { count: d.attempts })}
            </p>
            <p>
              <bdi>{t("enqueued", { time: when(d.enqueued_at) })}</bdi> · <bdi>{t("failed", { time: when(d.failed_at) })}</bdi>
            </p>
            {d.last_error && (
              <p className="break-all">
                <bdi>{t("error", { error: d.last_error })}</bdi>
              </p>
            )}
            <p className="break-all font-mono text-xs text-secondary">
              {t("payload", { payload: isolate(JSON.stringify(d.payload)) })}
            </p>
          </li>
        ))}
      </ol>
      {next && (
        <button type="button" className={quietButtonClass} onClick={() => setBefore(next)}>
          {ta("loadMore")}
        </button>
      )}
    </div>
  );
}
