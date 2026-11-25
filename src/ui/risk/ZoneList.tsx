"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatReason, type ReasonTranslate } from "@/src/shared/reason";
import { HAZARDS, scoreFor, type Hazard, type RiskRow } from "@/src/shared/risk";
import { LevelBadge } from "./LevelBadge";

// The zones as a list: the same information as the map, for everyone
// (screen readers, no WebGL, the map not loading). Each zone opens to show
// the score of each hazard. The reason shows on the closed row, so a low
// score always comes with why.
export function ZoneList({
  rows,
  names,
  hazard,
}: {
  rows: RiskRow[];
  names: Record<number, string>;
  hazard: Hazard | null;
}) {
  const t = useTranslations("risk");
  const tr = useTranslations("reason");
  const translate: ReasonTranslate = (key, values) => tr(key as never, values as never);

  // Coming from the 48 h strip (/#zone-3): open that zone and show it.
  useEffect(() => {
    const match = /^#zone-([1-6])$/.exec(window.location.hash);
    const item = match && document.getElementById(`zone-${match[1]}`);
    const details = item?.querySelector("details");
    if (!details) return;
    details.open = true;
    item!.scrollIntoView({ block: "center" });
  }, []);

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const { score, level } = scoreFor(row, hazard);
        const reason = formatReason(row, translate);
        return (
          <li key={row.zone_id} id={`zone-${row.zone_id}`}>
            <details className="group rounded-lg border border-border bg-elevated">
              <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <span className="min-w-0 flex-1 font-bold">
                  {t("zoneTitle", { zone: row.zone_id, name: names[row.zone_id] ?? "" })}
                </span>
                <LevelBadge level={level} />
                <span className="font-mono text-sm tabular-nums" dir="ltr">
                  {score.toFixed(2)}
                </span>
                <span className="basis-full text-sm text-secondary">
                  <bdi>{reason.text}</bdi>
                  {reason.english && (
                    <span className="ms-2 rounded-sm bg-surface px-1 text-xs text-secondary">{t("englishTag")}</span>
                  )}
                </span>
              </summary>
              <div className="flex flex-col gap-2 border-t border-border p-3 text-sm">
                {!hazard && (
                  <p className="text-secondary">
                    {t("range", { low: row.risk_low.toFixed(2), high: row.risk_high.toFixed(2) })} ·{" "}
                    {t(`confidence.${row.confidence}`)}
                  </p>
                )}
                <p className="font-bold">{t("hazardScores")}</p>
                <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
                  {HAZARDS.map((h) => (
                    <div key={h} className="contents">
                      <dt>{t(`hazard.${h}`)}</dt>
                      <dd className="h-2 overflow-hidden rounded-sm bg-surface" aria-hidden="true">
                        <div className="h-full bg-primary" style={{ width: `${Math.round(row.hazards[h] * 100)}%` }} />
                      </dd>
                      <dd className="font-mono tabular-nums" dir="ltr">
                        {row.hazards[h].toFixed(2)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
