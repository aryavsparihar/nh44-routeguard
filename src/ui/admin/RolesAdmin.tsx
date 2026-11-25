"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { sendJson } from "@/src/ui/api";
import { Field, Notice, buttonClass, inputClass, useErrorText } from "./common";

const ROLES = ["grower", "trader", "agent", "driver", "police", "admin"] as const;
type Role = (typeof ROLES)[number];

// PATCH /api/v1/admin/users/{id}/role with a written reason (audited by the
// admin_set_role database function).
export function RolesAdmin() {
  const t = useTranslations("admin.users");
  const ta = useTranslations("admin");
  const errorText = useErrorText();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("police");
  const [reason, setReason] = useState("");
  const [bad, setBad] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const roleName = (r: string | null) => (r && (ROLES as readonly string[]).includes(r) ? t(`roles.${r as Role}`) : t("noRole"));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const id = userId.trim();
    if (!/^user_[A-Za-z0-9]+$/.test(id)) {
      setBad(["id"]);
      setNotice({ kind: "error", text: errorText(422) });
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await sendJson<{ old_role: string | null; role: string }>(
      "PATCH",
      `/api/v1/admin/users/${encodeURIComponent(id)}/role`,
      { role, reason },
    );
    setBusy(false);
    if (!result.ok) {
      setBad(result.fields);
      const text = result.status === 404 ? t("notFound") : result.status === 409 ? t("self") : errorText(result.status);
      setNotice({ kind: "error", text });
      return;
    }
    setBad([]);
    setReason("");
    setNotice({ kind: "ok", text: t("done", { from: roleName(result.data.old_role), to: roleName(result.data.role) }) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-3" noValidate>
      <p>{t("intro")}</p>
      <Field id="id" label={t("userId")} invalid={bad.includes("id")}>
        <input
          id="id"
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono`}
          placeholder="user_"
          maxLength={64}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          aria-invalid={bad.includes("id")}
        />
      </Field>
      <Field id="role" label={t("role")} invalid={bad.includes("role")}>
        <select id="role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="reason" label={t("reason")} invalid={bad.includes("reason")}>
        <textarea
          id="reason"
          rows={2}
          className={`${inputClass} py-2`}
          required
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={bad.includes("reason")}
        />
      </Field>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <div>
        <button type="submit" className={buttonClass} disabled={busy || !reason.trim()}>
          {busy ? ta("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
