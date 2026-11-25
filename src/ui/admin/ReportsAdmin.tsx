"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Locale } from "@/src/i18n/routing";
import type { PublicReport } from "@/src/shared/api-types";
import { formatDayTime } from "@/src/shared/format";
import { getJson, sendJson, type ApiList } from "@/src/ui/api";
import { Field, Notice, buttonClass, inputClass, quietButtonClass, useErrorText } from "./common";

const STATUSES = ["unconfirmed", "confirmed", "expired", "resolved", "hidden"] as const;
type Status = (typeof STATUSES)[number];
type Action = "hide" | "resolve" | "restore";

type AdminReport = Omit<PublicReport, "status"> & {
  status: Status;
  hidden_reason: string | null;
  flags: number;
};

// Which buttons a report in each state gets (the API checks the same table).
const ACTIONS_FOR: Record<Status, Action[]> = {
  unconfirmed: ["hide", "resolve"],
  confirmed: ["hide", "resolve"],
  expired: ["hide", "resolve"],
  resolved: ["hide"],
  hidden: ["restore"],
};

// Moderation (B2): every report, hidden ones too, with its flag count.
// Hiding, resolving and restoring each need a reason and go in the audit log.
export function ReportsAdmin() {
  const t = useTranslations("admin.reports");
  const tr = useTranslations("reports");
  const ta = useTranslations("admin");
  const errorText = useErrorText();
  const locale = useLocale() as Locale;
  const [status, setStatus] = useState<Status | "">("");
  const [request, setRequest] = useState<{ before: string | null; n: number }>({ before: null, n: 0 });
  const [rows, setRows] = useState<AdminReport[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState<{ id: string; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (request.before) params.set("cursor", request.before);
    if (status) params.set("status", status);
    const query = params.size ? `?${params}` : "";
    getJson<ApiList<AdminReport, { next_cursor: string | null }>>(`/api/v1/admin/reports${query}`, controller.signal).then(
      (page) => {
        setRows((old) => (request.before ? [...old, ...page.data] : page.data));
        setNext(page.meta.next_cursor);
        setState("ready");
      },
      () => {
        if (!controller.signal.aborted) setState("error");
      },
    );
    return () => controller.abort();
  }, [request, status]);

  async function save() {
    if (!open || !reason.trim()) return;
    setSaving(true);
    setNotice(null);
    const res = await sendJson<{ id: string; status: Status }>("PATCH", `/api/v1/admin/reports/${open.id}`, {
      action: open.action,
      reason: reason.trim(),
    });
    setSaving(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: errorText(res.status) });
      return;
    }
    const saved = res.data;
    setRows((old) =>
      old.map((r) =>
        r.id === saved.id
          ? { ...r, status: saved.status, hidden_reason: saved.status === "hidden" ? reason.trim() : null }
          : r,
      ),
    );
    setNotice({ kind: "ok", text: t(`done.${open.action}`) });
    setOpen(null);
    setReason("");
  }

  return (
    <div className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      <Field id="reports-status" label={t("filter")} invalid={false}>
        <select
          id="reports-status"
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status | "");
            setRequest((r) => ({ before: null, n: r.n + 1 }));
          }}
        >
          <option value="">{t("all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </Field>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {state === "loading" && <p role="status">{ta("loading")}</p>}
      {state === "error" && <Notice kind="error">{ta("err.load")}</Notice>}
      {state === "ready" && rows.length === 0 && <p className="text-sm text-secondary">{t("none")}</p>}
      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 rounded-lg border border-border bg-elevated p-3 text-sm">
            <p className="font-bold">
              {tr("item", {
                hazard: tr(`hazard.${r.hazard_type}`),
                zone: r.zone_id ?? "-",
                time: formatDayTime(new Date(r.created_at), locale),
              })}
            </p>
            <p className="text-secondary">
              {t(`status.${r.status}`)} · {tr(`source.${r.source}`)} · {tr("confirmations", { count: r.confirmations })} ·{" "}
              {t("flags", { count: r.flags })}
              {r.is_demo && ` · ${tr("demo")}`}
            </p>
            {r.note && (
              <p>
                <bdi>{r.note}</bdi>
              </p>
            )}
            {r.hidden_reason && (
              <p>
                <bdi>{t("hiddenBecause", { reason: r.hidden_reason })}</bdi>
              </p>
            )}
            {r.has_photo && (r.status === "unconfirmed" || r.status === "confirmed") && (
              <a href={`/api/v1/reports/${r.id}/photo`} target="_blank" rel="noopener noreferrer" className="underline">
                {t("photo")}
              </a>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {ACTIONS_FOR[r.status].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={quietButtonClass}
                  aria-expanded={open?.id === r.id && open.action === a}
                  onClick={() => {
                    setOpen({ id: r.id, action: a });
                    setReason("");
                    setNotice(null);
                  }}
                >
                  {t(`action.${a}`)}
                </button>
              ))}
            </div>
            {open?.id === r.id && (
              <div className="flex flex-col gap-2 pt-1">
                <Field id={`reason-${r.id}`} label={t("reason")} hint={t("reasonHint")} invalid={false}>
                  <input
                    id={`reason-${r.id}`}
                    className={inputClass}
                    maxLength={280}
                    value={reason}
                    aria-describedby={`reason-${r.id}-hint`}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass} onClick={save} disabled={saving || !reason.trim()}>
                    {saving ? ta("saving") : t(`action.${open.action}`)}
                  </button>
                  <button type="button" className={quietButtonClass} onClick={() => setOpen(null)}>
                    {ta("cancel")}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {next && (
        <button
          type="button"
          className={quietButtonClass}
          onClick={() => setRequest((r) => ({ before: next, n: r.n + 1 }))}
        >
          {ta("loadMore")}
        </button>
      )}
    </div>
  );
}
