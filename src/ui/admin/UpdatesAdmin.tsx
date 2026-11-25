"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/src/i18n/routing";
import { EXTERNAL_REL, formatDayTime, isolate, sourceHost } from "@/src/shared/format";
import { ApiFetchError, getJson, sendJson, type ApiList } from "@/src/ui/api";
import { NotOfficial } from "@/src/ui/NotOfficial";
import {
  Field,
  Notice,
  buttonClass,
  fromIstInput,
  inputClass,
  quietButtonClass,
  toIstInput,
  useErrorText,
} from "./common";

const KINDS = ["closure", "one_way", "reopened", "advisory"] as const;
const ZONES = [1, 2, 3, 4, 5, 6] as const;

// One version as GET /api/v1/admin/official-updates sends it.
type AdminUpdate = {
  id: string;
  zone_id: number | null;
  kind: (typeof KINDS)[number];
  title: string;
  body: string | null;
  source_url: string;
  source_name: string;
  issued_at: string;
  valid_until: string;
  version: number;
  supersedes_id: string | null;
  created_at: string;
  deleted_at: string | null;
  delete_reason: string | null;
};

type Draft = {
  kind: (typeof KINDS)[number];
  zone: string; // "" = whole road
  title: string;
  body: string;
  source_name: string;
  source_url: string;
  issued_at: string; // datetime-local, IST
  valid_until: string;
  reason: string;
};

const emptyDraft = (): Draft => ({
  kind: "closure",
  zone: "",
  title: "",
  body: "",
  source_name: "",
  source_url: "",
  issued_at: toIstInput(new Date()),
  valid_until: "",
  reason: "",
});

const draftOf = (u: AdminUpdate): Draft => ({
  kind: u.kind,
  zone: u.zone_id ? String(u.zone_id) : "",
  title: u.title,
  body: u.body ?? "",
  source_name: u.source_name,
  source_url: u.source_url,
  issued_at: toIstInput(new Date(u.issued_at)),
  valid_until: toIstInput(new Date(u.valid_until)),
  reason: "",
});

function statusOf(u: AdminUpdate, now: number): "live" | "ended" | "replaced" | "deleted" {
  if (u.deleted_at) return u.delete_reason?.startsWith("Replaced by version") ? "replaced" : "deleted";
  return Date.parse(u.valid_until) > now ? "live" : "ended";
}

// Police and admins post, edit (a new version) and soft delete updates.
export function UpdatesAdmin() {
  const t = useTranslations("admin.updates");
  const ta = useTranslations("admin");
  const tk = useTranslations("updates");
  const locale = useLocale() as Locale;
  const errorText = useErrorText();

  const [rows, setRows] = useState<AdminUpdate[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [editing, setEditing] = useState<AdminUpdate | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [bad, setBad] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [now, setNow] = useState(0);

  // Each request for a page; changing it (re)loads. after = null starts over.
  const [request, setRequest] = useState<{ after: string | null; n: number }>({ after: null, n: 0 });
  const load = useCallback((after: string | null) => setRequest((r) => ({ after, n: r.n + 1 })), []);

  useEffect(() => {
    const controller = new AbortController();
    const { after } = request;
    getJson<ApiList<AdminUpdate, { next_cursor: string | null }>>(
      `/api/v1/admin/official-updates${after ? `?cursor=${encodeURIComponent(after)}` : ""}`,
      controller.signal,
    ).then(
      (page) => {
        setRows((old) => (after ? [...old, ...page.data] : page.data));
        setCursor(page.meta.next_cursor);
        setNow(Date.now());
        setLoadState("ready");
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState("error");
        if (error instanceof ApiFetchError) setNotice({ kind: "error", text: errorText(error.status) });
      },
    );
    return () => controller.abort();
  }, [request, errorText]);

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  function startEdit(u: AdminUpdate) {
    setEditing(u);
    setDraft(draftOf(u));
    setBad([]);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(emptyDraft());
    setBad([]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const issued = fromIstInput(draft.issued_at);
    const until = fromIstInput(draft.valid_until);
    const localBad = [!issued && "issued_at", !until && "valid_until"].filter(Boolean) as string[];
    if (localBad.length) {
      setBad(localBad);
      setNotice({ kind: "error", text: errorText(422) });
      return;
    }
    const fields = {
      kind: draft.kind,
      zone_id: draft.zone ? Number(draft.zone) : null,
      title: draft.title,
      body: draft.body.trim() ? draft.body : null,
      source_name: draft.source_name,
      source_url: draft.source_url,
      issued_at: issued,
      valid_until: until,
    };
    setBusy(true);
    setNotice(null);
    const result = editing
      ? await sendJson<AdminUpdate>("PATCH", `/api/v1/admin/official-updates/${editing.id}`, {
          ...changedFields(editing, fields),
          ...(draft.reason.trim() ? { reason: draft.reason } : {}),
        })
      : await sendJson<AdminUpdate>("POST", "/api/v1/admin/official-updates", fields);
    setBusy(false);
    if (!result.ok) {
      setBad(result.fields);
      setNotice({ kind: "error", text: result.status === 409 && editing ? t("conflict") : errorText(result.status) });
      return;
    }
    setBad([]);
    setNotice({
      kind: "ok",
      text: editing ? t("versionSaved", { version: isolate(result.data.version) }) : t("posted"),
    });
    setEditing(null);
    setDraft(emptyDraft());
    load(null);
  }

  async function confirmDelete(id: string) {
    setBusy(true);
    const result = await sendJson<AdminUpdate>("DELETE", `/api/v1/admin/official-updates/${id}`, {
      reason: deleteReason,
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.status === 409 ? t("conflict") : errorText(result.status) });
      return;
    }
    setDeleting(null);
    setDeleteReason("");
    setNotice({ kind: "ok", text: t("deleted") });
    load(null);
  }

  const invalid = (field: string) => bad.includes(field);
  const aria = (field: string) => ({
    "aria-invalid": invalid(field),
    "aria-describedby": invalid(field) ? `${field}-error` : undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      <NotOfficial />
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-3" noValidate>
        <h2 className="text-lg font-bold">
          {editing ? t("edit", { version: isolate(editing.version + 1) }) : t("new")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="kind" label={t("kind")} invalid={invalid("kind")}>
            <select id="kind" className={inputClass} value={draft.kind} onChange={(e) => set("kind")(e.target.value)} {...aria("kind")}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {tk(`kind.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="zone_id" label={t("zone")} invalid={invalid("zone_id")}>
            <select id="zone_id" className={inputClass} value={draft.zone} onChange={(e) => set("zone")(e.target.value)} {...aria("zone_id")}>
              <option value="">{tk("wholeRoad")}</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {tk("zone", { zone: z })}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="title" label={t("title")} invalid={invalid("title")}>
          <input id="title" className={inputClass} required maxLength={120} value={draft.title} onChange={(e) => set("title")(e.target.value)} {...aria("title")} />
        </Field>
        <Field id="body" label={t("body")} invalid={invalid("body")}>
          <textarea id="body" className={`${inputClass} py-2`} rows={3} maxLength={1000} value={draft.body} onChange={(e) => set("body")(e.target.value)} {...aria("body")} />
        </Field>
        <Field id="source_name" label={t("sourceName")} hint={t("sourceNameHint")} invalid={invalid("source_name")}>
          <input id="source_name" className={inputClass} required maxLength={120} value={draft.source_name} onChange={(e) => set("source_name")(e.target.value)} {...aria("source_name")} />
        </Field>
        <Field id="source_url" label={t("sourceUrl")} invalid={invalid("source_url")}>
          <input id="source_url" type="url" inputMode="url" dir="ltr" className={inputClass} required maxLength={500} placeholder="https://" value={draft.source_url} onChange={(e) => set("source_url")(e.target.value)} {...aria("source_url")} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="issued_at" label={t("issuedAt")} invalid={invalid("issued_at")}>
            <input id="issued_at" type="datetime-local" dir="ltr" className={inputClass} required value={draft.issued_at} onChange={(e) => set("issued_at")(e.target.value)} {...aria("issued_at")} />
          </Field>
          <Field id="valid_until" label={t("validUntil")} invalid={invalid("valid_until")}>
            <input id="valid_until" type="datetime-local" dir="ltr" className={inputClass} required value={draft.valid_until} onChange={(e) => set("valid_until")(e.target.value)} {...aria("valid_until")} />
          </Field>
        </div>
        {editing && (
          <Field id="reason" label={t("reason")} invalid={invalid("reason")}>
            <input id="reason" className={inputClass} maxLength={500} value={draft.reason} onChange={(e) => set("reason")(e.target.value)} {...aria("reason")} />
          </Field>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonClass} disabled={busy}>
            {busy ? ta("saving") : editing ? t("saveVersion") : t("post")}
          </button>
          {editing && (
            <button type="button" className={quietButtonClass} onClick={cancelEdit}>
              {ta("cancel")}
            </button>
          )}
        </div>
      </form>

      <section aria-labelledby="history-heading" className="flex flex-col gap-2">
        <h2 id="history-heading" className="text-lg font-bold">
          {t("history")}
        </h2>
        {loadState === "loading" && <p role="status">{ta("loading")}</p>}
        {loadState === "error" && <Notice kind="error">{ta("err.load")}</Notice>}
        {loadState === "ready" && rows.length === 0 && <p className="text-sm text-secondary">{t("none")}</p>}
        <ul className="flex flex-col gap-2">
          {rows.map((u) => {
            const status = statusOf(u, now);
            const open = status === "live" || status === "ended";
            return (
              <li key={u.id} className="flex flex-col gap-1 rounded-lg border border-border bg-elevated p-3 text-sm">
                <p className="font-bold">
                  {t(`status.${status}`)} · {t("version", { version: isolate(u.version) })} · {tk(`kind.${u.kind}`)} ·{" "}
                  {u.zone_id ? tk("zone", { zone: u.zone_id }) : tk("wholeRoad")}
                </p>
                <p className="text-base font-bold">
                  <bdi>{u.title}</bdi>
                </p>
                {u.body && (
                  <p>
                    <bdi>{u.body}</bdi>
                  </p>
                )}
                <p>
                  <bdi>{tk("from", { name: u.source_name })}</bdi> ·{" "}
                  <a href={u.source_url} target="_blank" rel={EXTERNAL_REL} className="underline">
                    {tk("sourceLink")}
                    {sourceHost(u.source_url) && <> ({isolate(sourceHost(u.source_url)!)})</>}
                  </a>
                </p>
                <p className="text-secondary">
                  {tk("issued", { time: isolate(formatDayTime(new Date(u.issued_at), locale)) })} ·{" "}
                  {tk("validUntil", { time: isolate(formatDayTime(new Date(u.valid_until), locale)) })}
                </p>
                {status === "deleted" && u.delete_reason && (
                  <p>
                    <bdi>{t("deletedReason", { reason: u.delete_reason })}</bdi>
                  </p>
                )}
                {open && deleting !== u.id && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" className={quietButtonClass} onClick={() => startEdit(u)}>
                      {t("editButton")}
                    </button>
                    <button
                      type="button"
                      className={quietButtonClass}
                      onClick={() => {
                        setDeleting(u.id);
                        setDeleteReason("");
                      }}
                    >
                      {t("deleteButton")}
                    </button>
                  </div>
                )}
                {deleting === u.id && (
                  <div className="flex flex-col gap-2 pt-1">
                    <Field id={`delete-${u.id}`} label={t("deleteReason")} invalid={false}>
                      <input
                        id={`delete-${u.id}`}
                        className={inputClass}
                        maxLength={280}
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-12 rounded-md bg-high-fill px-4 font-bold text-inverse disabled:opacity-60"
                        disabled={busy || !deleteReason.trim()}
                        onClick={() => void confirmDelete(u.id)}
                      >
                        {t("confirmDelete")}
                      </button>
                      <button type="button" className={quietButtonClass} onClick={() => setDeleting(null)}>
                        {ta("cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {cursor && (
          <button type="button" className={quietButtonClass} onClick={() => load(cursor)}>
            {ta("loadMore")}
          </button>
        )}
      </section>
    </div>
  );
}

// PATCH sends only what changed, so the audit log lists the real edits.
function changedFields(old: AdminUpdate, next: Record<string, unknown>): Record<string, unknown> {
  const before: Record<string, unknown> = {
    kind: old.kind,
    zone_id: old.zone_id,
    title: old.title,
    body: old.body,
    source_name: old.source_name,
    source_url: old.source_url,
    // The form holds minutes, so compare at that precision.
    issued_at: fromIstInput(toIstInput(new Date(old.issued_at))),
    valid_until: fromIstInput(toIstInput(new Date(old.valid_until))),
  };
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => before[key] !== value));
}
