"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/src/i18n/routing";
import type { ReviewUser } from "@/src/shared/api-types";
import { formatDate, isolate } from "@/src/shared/format";
import { sendJson, useApi, type ApiList } from "@/src/ui/api";
import { Field, Notice, buttonClass, inputClass, quietButtonClass, useErrorText } from "./common";

type Tab = "pending" | "rejected";

// TCU's queue (GET /api/v1/admin/users): every new account waits here until
// TCU approves it or turns it down with a reason (POST .../review). Both are
// written to the audit log by the tcu_review_user database function.
export function ApprovalsAdmin() {
  const t = useTranslations("admin.approvals");
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, retry, refresh] = useApi<ApiList<ReviewUser>>(`/api/v1/admin/users?approval=${tab}`);
  const chip =
    "min-h-11 rounded-full border border-border-strong px-4 text-sm font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-inverse";

  return (
    <div className="flex flex-col gap-3">
      <p>{t("intro")}</p>
      <div role="group" aria-label={t("show")} className="flex gap-2">
        {(["pending", "rejected"] as const).map((k) => (
          <button key={k} type="button" className={chip} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>
      {rows.state === "loading" && <p role="status">{t("loading")}</p>}
      {rows.state === "error" && (
        <div className="flex flex-col gap-2">
          <Notice kind="error">{t("loadError")}</Notice>
          <button type="button" className={quietButtonClass} onClick={retry}>
            {t("retry")}
          </button>
        </div>
      )}
      {rows.state === "ready" && rows.value.data.length === 0 && (
        <p className="rounded-md bg-surface p-3">{tab === "pending" ? t("emptyPending") : t("emptyRejected")}</p>
      )}
      {rows.state === "ready" && rows.value.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.value.data.map((user) => (
            <li key={user.id}>
              <ReviewCard user={user} onDone={refresh} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ user, onDone }: { user: ReviewUser; onDone: () => void }) {
  const t = useTranslations("admin.approvals");
  const tm = useTranslations("me");
  const tb = useTranslations("board");
  const locale = useLocale() as Locale;
  const errorText = useErrorText();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    setNotice(null);
    const result = await sendJson<{ approval: string }>(
      "POST",
      `/api/v1/admin/users/${encodeURIComponent(user.id)}/review`,
      decision === "approved" ? { decision } : { decision, note: note.trim() },
    );
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.status === 409 ? t("already") : errorText(result.status) });
      return;
    }
    setNotice({ kind: "ok", text: decision === "approved" ? t("approvedDone") : t("rejectedDone") });
    onDone();
  }

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-elevated p-3">
      <h2 className="flex flex-wrap items-baseline gap-x-2 font-bold">
        <bdi>{user.display_name ?? t("noName")}</bdi>
        <span className="text-sm font-normal text-secondary">{tm(`role.${user.role}`)}</span>
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-secondary">{t("email")}</dt>
        <dd dir="ltr" className="break-all">
          {user.email ?? "–"}
        </dd>
        <dt className="text-secondary">{t("asked")}</dt>
        <dd>{isolate(formatDate(new Date(user.created_at), locale))}</dd>
        <dt className="text-secondary">{t("level")}</dt>
        <dd>{tb(`level.${user.verification_level}`)}</dd>
        <dt className="text-secondary">{t("userId")}</dt>
        <dd dir="ltr" className="font-mono text-xs">
          {user.id}
        </dd>
        {user.approval === "rejected" && user.review_note && (
          <>
            <dt className="text-secondary">{t("reason")}</dt>
            <dd>
              <bdi>{user.review_note}</bdi>
            </dd>
          </>
        )}
      </dl>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {!rejecting && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void decide("approved")}>
            {busy ? t("saving") : t("approve")}
          </button>
          {user.approval === "pending" && (
            <button type="button" className={quietButtonClass} disabled={busy} onClick={() => setRejecting(true)}>
              {t("reject")}
            </button>
          )}
        </div>
      )}
      {rejecting && (
        <div className="flex flex-col gap-2">
          <Field id={`note-${user.id}`} label={t("reasonLabel")} hint={t("reasonHint")} invalid={false}>
            <textarea
              id={`note-${user.id}`}
              rows={2}
              maxLength={500}
              className={`${inputClass} py-2`}
              value={note}
              aria-describedby={`note-${user.id}-hint`}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-12 rounded-md bg-high-fill px-4 font-bold text-inverse disabled:opacity-60"
              disabled={busy || !note.trim()}
              onClick={() => void decide("rejected")}
            >
              {busy ? t("saving") : t("confirmReject")}
            </button>
            <button type="button" className={quietButtonClass} disabled={busy} onClick={() => setRejecting(false)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
