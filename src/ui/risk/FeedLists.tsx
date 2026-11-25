"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/src/i18n/routing";
import type { OfficialUpdate, PublicReport } from "@/src/shared/api-types";
import { formatDayTime, isolate } from "@/src/shared/format";
import { NotOfficial } from "@/src/ui/NotOfficial";

// Police/TCU updates in force. Each one links to where it was published.
export function OfficialUpdates({ updates }: { updates: OfficialUpdate[] }) {
  const t = useTranslations("updates");
  const locale = useLocale() as Locale;
  return (
    <section aria-labelledby="updates-heading" className="flex flex-col gap-2">
      <h2 id="updates-heading" className="text-lg font-bold">
        {t("heading")}
      </h2>
      <NotOfficial />
      {updates.length === 0 ? (
        <p className="text-sm text-secondary">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {updates.map((u) => (
            <li key={u.id} className="rounded-lg border-s-4 border-rail-fill bg-rail-bg p-3 text-rail-text">
              <p className="text-sm font-bold">
                {t(`kind.${u.kind}`)} · {u.zone_id ? t("zone", { zone: u.zone_id }) : t("wholeRoad")}
              </p>
              <p className="font-bold">
                <bdi>{u.title}</bdi>
              </p>
              {u.body && (
                <p className="text-sm">
                  <bdi>{u.body}</bdi>
                </p>
              )}
              <p className="text-sm">
                <bdi>{t("from", { name: u.source_name })}</bdi> ·{" "}
                <a href={u.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                  {t("sourceLink")}
                </a>{" "}
                · {t("issued", { time: isolate(formatDayTime(new Date(u.issued_at), locale)) })} ·{" "}
                {t("validUntil", { time: isolate(formatDayTime(new Date(u.valid_until), locale)) })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Road reports on the map now, with the legend for their markers.
export function RoadReports({ reports }: { reports: PublicReport[] }) {
  const t = useTranslations("reports");
  const locale = useLocale() as Locale;
  return (
    <section aria-labelledby="reports-heading" className="flex flex-col gap-2">
      <h2 id="reports-heading" className="text-lg font-bold">
        {t("heading")}
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t("heading")}>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-4 rounded-full border-[3px] border-solid border-primary bg-elevated" />
          {t("legendConfirmed")}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-4 rounded-full border-[3px] border-dashed border-primary bg-elevated" />
          {t("legendUnconfirmed")}
        </li>
      </ul>
      {reports.length === 0 ? (
        <p className="text-sm text-secondary">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-elevated p-3 text-sm">
              <p className="font-bold">
                {t("item", {
                  hazard: t(`hazard.${r.hazard_type}`),
                  zone: r.zone_id ?? "-",
                  time: formatDayTime(new Date(r.created_at), locale),
                })}
              </p>
              <p className="text-secondary">
                {t(`status.${r.status}`)} · {t(`source.${r.source}`)} · {t("confirmations", { count: r.confirmations })}
                {r.is_demo && ` · ${t("demo")}`}
              </p>
              {r.note && (
                <p>
                  <bdi>{r.note}</bdi>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
