"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PublicReport } from "@/src/shared/api-types";
import { sendJson } from "@/src/ui/api";
import { quietButtonClass, inputClass } from "@/src/ui/admin/common";

const FLAG_REASONS = ["not_there", "wrong_place", "duplicate", "offensive", "other"] as const;
type FlagReason = (typeof FLAG_REASONS)[number];

type Message = { kind: "ok" | "error"; text: string; signIn?: boolean };

// Where the phone is now, for a confirmation. Only the distance to the report
// is stored. Without it the confirmation is saved but doesn't count towards
// "confirmed" (2 verified people within 2 km).
function here(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 10_000, maximumAge: 120_000 },
    ),
  );
}

// "I see it too", "Flag" and the photo link under one road report. Anyone
// can press them; the API answers 401/403 and we say why.
export function ReportActions({
  report,
  onChange,
}: {
  report: PublicReport;
  onChange: (next: Partial<PublicReport>) => void;
}) {
  const t = useTranslations("reports.actions");
  const [busy, setBusy] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState<FlagReason>("not_there");
  const [message, setMessage] = useState<Message | null>(null);

  function failed(status: number): Message {
    if (status === 401) return { kind: "error", text: t("signIn"), signIn: true };
    if (status === 403) return { kind: "error", text: t("forbidden") };
    if (status === 404) return { kind: "error", text: t("gone") };
    if (status === 409) return { kind: "error", text: t("inactive") };
    if (status === 429) return { kind: "error", text: t("tooMany") };
    if (status === 503) return { kind: "error", text: t("paused") };
    return { kind: "error", text: t("failed") };
  }

  async function confirm() {
    setBusy(true);
    setMessage(null);
    const spot = await here();
    const res = await sendJson<{ status: PublicReport["status"]; confirmations: number; outcome: "confirmed" | "repeat" }>(
      "POST",
      `/api/v1/reports/${report.id}/confirm`,
      spot ?? {},
    );
    setBusy(false);
    if (!res.ok) return setMessage(failed(res.status));
    onChange({ status: res.data.status, confirmations: res.data.confirmations });
    setMessage({
      kind: "ok",
      text: res.data.outcome === "repeat" ? t("confirmedBefore") : spot ? t("confirmed") : t("confirmedNoPlace"),
    });
  }

  async function flag() {
    setBusy(true);
    setMessage(null);
    const res = await sendJson<{ status: string; outcome: "flagged" | "repeat" }>(
      "POST",
      `/api/v1/reports/${report.id}/flag`,
      { reason },
    );
    setBusy(false);
    if (!res.ok) return setMessage(failed(res.status));
    setFlagging(false);
    setMessage({ kind: "ok", text: res.data.outcome === "repeat" ? t("flaggedBefore") : t("flagged") });
  }

  const selectId = `flag-${report.id}`;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={quietButtonClass} onClick={confirm} disabled={busy}>
          {t("confirm")}
        </button>
        <button
          type="button"
          className={quietButtonClass}
          onClick={() => setFlagging((f) => !f)}
          disabled={busy}
          aria-expanded={flagging}
          aria-controls={`${selectId}-box`}
        >
          {t("flag")}
        </button>
        {report.has_photo && (
          <a
            href={`/api/v1/reports/${report.id}/photo`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${quietButtonClass} inline-flex items-center underline`}
          >
            {t("photo")}
          </a>
        )}
      </div>
      {flagging && (
        <div id={`${selectId}-box`} className="flex flex-wrap items-end gap-2">
          <label htmlFor={selectId} className="flex min-w-0 flex-1 flex-col gap-1 font-bold">
            {t("why")}
            <select
              id={selectId}
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value as FlagReason)}
            >
              {FLAG_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reason.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={quietButtonClass} onClick={flag} disabled={busy}>
            {t("sendFlag")}
          </button>
        </div>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-high-text" : "text-send-text"}>
          {message.text}{" "}
          {message.signIn && (
            <Link href="/report/new" prefetch={false} className="underline">
              {t("signInLink")}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
