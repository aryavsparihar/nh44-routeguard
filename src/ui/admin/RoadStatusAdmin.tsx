"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/src/i18n/routing";
import { EXTERNAL_REL, formatDayTime, isolate, sourceHost } from "@/src/shared/format";
import { sendJson, useApi, type ApiList } from "@/src/ui/api";
import { LoadError } from "@/src/ui/risk/states";
import { Field, Notice, buttonClass, inputClass, useErrorText } from "./common";

const ITEMS = ["mughal_road", "rail_parcel"] as const;
const STATES = ["open", "closed", "unknown"] as const;
type Item = (typeof ITEMS)[number];
type State = (typeof STATES)[number];
type Row = { item: Item; state: State; source_url: string | null; updated_at: string };

// Admins set Mughal Road and the parcel train. The advisor only suggests
// them when they are "open" here (L14).
export function RoadStatusAdmin() {
  const t = useTranslations("admin.road");
  const ta = useTranslations("admin");
  const [loaded, retry] = useApi<ApiList<Row>>("/api/v1/road-status");

  if (loaded.state === "loading") return <p role="status">{ta("loading")}</p>;
  if (loaded.state === "error") return <LoadError retry={retry} />;
  return (
    <div className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      {ITEMS.map((item) => (
        <ItemForm key={item} item={item} row={loaded.value.data.find((r) => r.item === item) ?? null} />
      ))}
    </div>
  );
}

function ItemForm({ item, row }: { item: Item; row: Row | null }) {
  const t = useTranslations("admin.road");
  const ta = useTranslations("admin");
  const locale = useLocale() as Locale;
  const errorText = useErrorText();
  const [current, setCurrent] = useState<Row | null>(row);
  const [state, setState] = useState<State>(row?.state ?? "unknown");
  const [source, setSource] = useState(row?.source_url ?? "");
  const [reason, setReason] = useState("");
  const [bad, setBad] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const result = await sendJson<Row>("PATCH", "/api/v1/admin/road-status", {
      item,
      state,
      source_url: state === "unknown" ? null : source.trim() || null,
      ...(reason.trim() ? { reason } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setBad(result.fields);
      setNotice({ kind: "error", text: errorText(result.status) });
      return;
    }
    setBad([]);
    setReason("");
    setCurrent(result.data);
    setNotice({ kind: "ok", text: t("saved") });
  }

  const sourceId = `${item}-source`;
  const sourceBad = bad.includes("source_url");
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-3" noValidate>
      <h2 className="text-lg font-bold">{t(`item.${item}`)}</h2>
      <p className="text-sm">
        {t("current", { state: t(`state.${current?.state ?? "unknown"}`) })}
        {current && <> · {t("updated", { time: isolate(formatDayTime(new Date(current.updated_at), locale)) })}</>}
        {current?.source_url && (
          <>
            {" · "}
            <a href={current.source_url} target="_blank" rel={EXTERNAL_REL} className="underline">
              {t("sourceNow")}
              {sourceHost(current.source_url) && <> ({isolate(sourceHost(current.source_url)!)})</>}
            </a>
          </>
        )}
      </p>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{t(`item.${item}`)}</legend>
        {STATES.map((s) => (
          <label
            key={s}
            className="flex min-h-12 items-center gap-2 rounded-md border border-border-strong px-3 has-[:checked]:border-highway has-[:checked]:bg-send-bg"
          >
            <input type="radio" name={`${item}-state`} value={s} checked={state === s} onChange={() => setState(s)} />
            {t(`state.${s}`)}
          </label>
        ))}
      </fieldset>
      {state !== "unknown" && (
        <Field id={sourceId} label={t("source")} invalid={sourceBad}>
          <input
            id={sourceId}
            type="url"
            inputMode="url"
            dir="ltr"
            className={inputClass}
            placeholder="https://"
            maxLength={500}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-invalid={sourceBad}
            aria-describedby={sourceBad ? `${sourceId}-error` : undefined}
          />
        </Field>
      )}
      <Field id={`${item}-reason`} label={t("reason")} invalid={bad.includes("reason")}>
        <input id={`${item}-reason`} className={inputClass} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <div>
        <button type="submit" className={buttonClass} disabled={busy}>
          {busy ? ta("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
