"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/src/i18n/routing";
import { formatDayTime, isolate } from "@/src/shared/format";
import type { ModelGap } from "@/src/shared/model-gaps";

// "Where reports and the model disagree" (src/shared/model-gaps.ts): confirmed
// road reports on cells the weather model scores Low for that hazard. Each
// line can open its cell on the map. Nothing here changes a score.
export function ModelGaps({
  gaps,
  zoneName,
  onShow,
}: {
  gaps: ModelGap[];
  zoneName: (zone: number) => string;
  onShow: (cellId: string) => void;
}) {
  const t = useTranslations("risk");
  const locale = useLocale() as Locale;
  return (
    <section aria-labelledby="gaps-heading" className="flex flex-col gap-2">
      <h2 id="gaps-heading" className="text-lg font-bold">
        {t("gaps.heading")}
      </h2>
      <p className="text-sm text-secondary">{t("gaps.intro")}</p>
      {gaps.length === 0 ? (
        <p className="text-sm">{t("gaps.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {gaps.map((g) => (
            <li
              key={`${g.id}:${g.hazard}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-dashed border-rail-fill bg-elevated p-3 text-sm"
            >
              <div className="flex flex-col gap-0.5">
                <p className="font-bold">
                  {t(`hazard.${g.hazard}`)} ·{" "}
                  {g.zone === null ? t("cell.unknown") : t("zoneTitle", { zone: g.zone, name: zoneName(g.zone) })}
                </p>
                <p>
                  {t("gaps.item", {
                    count: g.reports.length,
                    score: g.score.toFixed(2),
                    level: t("level.low"),
                  })}
                </p>
                <p className="text-secondary">
                  {t("gaps.newest", { time: isolate(formatDayTime(new Date(g.reports[0].created_at), locale)) })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onShow(g.id)}
                className="min-h-12 shrink-0 rounded-md border border-border-strong px-3 font-bold"
              >
                {t("gaps.show")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
