"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { HORIZONS, ZONE_IDS, worstZone, type Level, type RiskRow } from "@/src/shared/risk";
import { LoadError, Loading } from "./states";
import { useRisk } from "./useRisk";

const CELL: Record<Level, string> = {
  low: "bg-risk-low text-inverse",
  medium: "bg-risk-medium text-inverse pattern-medium",
  high: "bg-risk-high text-inverse pattern-high",
};

// The 48 h strip (C1): six zones by four times, each cell a level and a
// score, with the worst one named on top.
export function StripScreen() {
  const t = useTranslations("strip");
  const tr = useTranslations("risk");
  const risk = useRisk();

  if (risk.state === "loading") return <Loading />;
  if (risk.state === "error") return <LoadError retry={risk.retry} />;
  if (risk.rows.length === 0) return <p className="rounded-md bg-surface p-3">{tr("noScores")}</p>;

  const cell = (zone: number, h: number): RiskRow | undefined =>
    risk.rows.find((r) => r.zone_id === zone && r.horizon_hours === h);
  const when = (h: number) => (h === 0 ? tr("whenNow") : tr("whenLater", { hours: h }));
  const worst = worstZone(risk.rows);

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="rounded-lg border-s-4 border-border-strong bg-surface p-3 font-bold">
        {worst.kind === "all_low"
          ? t("allLow")
          : t("worst", {
              zone: worst.row.zone_id,
              name: risk.names[worst.row.zone_id] ?? "",
              level: tr(`level.${worst.row.level}`),
              when: when(worst.row.horizon_hours),
            })}
      </p>
      <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-[34%] text-start">
              {t("zoneCol")}
            </th>
            {HORIZONS.map((h) => (
              <th key={h} scope="col" className="text-center">
                {tr(`horizon.h${h}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZONE_IDS.map((zone) => (
            <tr key={zone}>
              <th scope="row" className="text-start font-normal">
                <Link href={`/#zone-${zone}`} className="block min-h-12 py-1 underline">
                  <span className="font-bold">{zone}</span> <bdi className="break-words">{risk.names[zone]}</bdi>
                </Link>
              </th>
              {HORIZONS.map((h) => {
                const row = cell(zone, h);
                if (!row) return <td key={h} className="text-center">–</td>;
                return (
                  <td
                    key={h}
                    className={`rounded-md text-center ${CELL[row.level]}`}
                    aria-label={t("cellLabel", {
                      zone,
                      when: tr(`horizon.h${h}`),
                      level: tr(`level.${row.level}`),
                      score: row.overall.toFixed(2),
                    })}
                  >
                    <span className="block font-mono font-bold tabular-nums" dir="ltr">
                      {row.overall.toFixed(2)}
                    </span>
                    <span className="block text-xs">{tr(`level.${row.level}`)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm text-secondary">{t("patternNote")}</p>
    </div>
  );
}
