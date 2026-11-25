"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Locale } from "@/src/i18n/routing";
import { formatDayTime, isolate } from "@/src/shared/format";
import { getJson, type ApiList } from "@/src/ui/api";
import { Field, Notice, inputClass, quietButtonClass } from "./common";

type Entry = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  request_id: string | null;
};

// Action names in the database → message keys (next-intl keys can't hold dots).
const ACTIONS = {
  "user.role_changed": "roleChanged",
  "official_update.created": "updateCreated",
  "official_update.edited": "updateEdited",
  "official_update.deleted": "updateDeleted",
  "road_status.updated": "roadStatus",
  "report.hidden": "reportHidden",
  "report.resolved": "reportResolved",
  "report.restored": "reportRestored",
} as const;
type Action = keyof typeof ACTIONS;
const ROLES = ["grower", "trader", "agent", "driver", "police", "admin"] as const;

// Read-only. Nobody can change or delete these rows (audit_log triggers).
export function AuditAdmin() {
  const t = useTranslations("admin.audit");
  const ta = useTranslations("admin");
  const tu = useTranslations("admin.users");
  const locale = useLocale() as Locale;
  const [action, setAction] = useState<Action | "">("");
  const [request, setRequest] = useState<{ before: string | null; n: number }>({ before: null, n: 0 });
  const [rows, setRows] = useState<Entry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (request.before) params.set("cursor", request.before);
    if (action) params.set("action", action);
    const query = params.size ? `?${params}` : "";
    getJson<ApiList<Entry, { next_cursor: string | null }>>(`/api/v1/admin/audit-log${query}`, controller.signal).then(
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
  }, [request, action]);

  const roleName = (r: string | null) =>
    r && (ROLES as readonly string[]).includes(r) ? tu(`roles.${r as (typeof ROLES)[number]}`) : (r ?? "-");
  const label = (a: string) => (a in ACTIONS ? t(`action.${ACTIONS[a as Action]}`) : a);

  return (
    <div className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      <Field id="audit-action" label={t("filter")} invalid={false}>
        <select
          id="audit-action"
          className={inputClass}
          value={action}
          onChange={(e) => {
            setAction(e.target.value as Action | "");
            setRequest((r) => ({ before: null, n: r.n + 1 }));
          }}
        >
          <option value="">{t("all")}</option>
          {(Object.keys(ACTIONS) as Action[]).map((a) => (
            <option key={a} value={a}>
              {label(a)}
            </option>
          ))}
        </select>
      </Field>
      {state === "loading" && <p role="status">{ta("loading")}</p>}
      {state === "error" && <Notice kind="error">{ta("err.load")}</Notice>}
      {state === "ready" && rows.length === 0 && <p className="text-sm text-secondary">{t("none")}</p>}
      <ol className="flex flex-col gap-2">
        {rows.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 rounded-lg border border-border bg-elevated p-3 text-sm">
            <p className="font-bold">
              {label(e.action)} · <bdi>{formatDayTime(new Date(e.at), locale)}</bdi>
            </p>
            <p>
              {t("by", { role: roleName(e.actor_role), id: isolate(e.actor_id ?? "-") })}
              {e.target_id && <> · {t("target", { target: isolate(`${e.target_type ?? ""} ${e.target_id}`.trim()) })}</>}
            </p>
            {e.reason && (
              <p>
                <bdi>{t("reason", { reason: e.reason })}</bdi>
              </p>
            )}
            {e.request_id && (
              <p className="break-all font-mono text-xs text-secondary">{t("request", { id: isolate(e.request_id) })}</p>
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
