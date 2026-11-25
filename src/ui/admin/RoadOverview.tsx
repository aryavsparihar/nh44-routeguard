"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import type { Locale } from "@/src/i18n/routing";
import type { OfficialUpdate, PublicReport } from "@/src/shared/api-types";
import { formatDayTime, isolate } from "@/src/shared/format";
import { useApi, type ApiList } from "@/src/ui/api";
import { OfficialUpdates, RoadReports } from "@/src/ui/risk/FeedLists";
import { StripScreen } from "@/src/ui/risk/StripScreen";
import { useMapSignal } from "@/src/ui/risk/useMapSignal";
import { useRisk } from "@/src/ui/risk/useRisk";
import { quietButtonClass } from "./common";

const ROAD_ITEMS = ["mughal_road", "rail_parcel"] as const;
type RoadRow = { item: string; state: "open" | "closed" | "unknown"; source_url: string | null; updated_at: string };

// Unconfirmed first (they need someone on the spot), newest first within each.
export function sortForReview(reports: PublicReport[]): PublicReport[] {
  return [...reports].sort(
    (a, b) =>
      Number(a.status === "confirmed") - Number(b.status === "confirmed") ||
      Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}

// The road overview: one screen for the police and admin accounts with what
// the public map and API already show (risk, road reports, police/TCU
// updates, road and rail status). Nothing about people: no names, no truck
// positions. Reports and updates refresh by themselves like the map.
export function RoadOverview({ canEditRoad }: { canEditRoad: boolean }) {
  const t = useTranslations("admin.overview");
  const locale = useLocale() as Locale;
  const risk = useRisk();
  const [reports, , refreshReports] = useApi<ApiList<PublicReport>>("/api/v1/reports");
  const [updates, , refreshUpdates] = useApi<ApiList<OfficialUpdate>>("/api/v1/official-updates");
  const [road] = useApi<ApiList<RoadRow>>("/api/v1/road-status");
  const refresh = useCallback(() => {
    refreshReports();
    refreshUpdates();
  }, [refreshReports, refreshUpdates]);
  useMapSignal(refresh);

  const now = risk.state === "ready" ? risk.rows.filter((r) => r.horizon_hours === 0) : [];
  const reportList = useMemo(() => (reports.state === "ready" ? sortForReview(reports.value.data) : []), [reports]);
  const runAt = risk.state === "ready" ? risk.meta.run_at : null;

  const tiles: { key: string; value: number | null; tone: string }[] = [
    { key: "highNow", value: risk.state === "ready" ? now.filter((r) => r.level === "high").length : null, tone: "border-high-fill" },
    { key: "mediumNow", value: risk.state === "ready" ? now.filter((r) => r.level === "medium").length : null, tone: "border-hold-fill" },
    { key: "waiting", value: reports.state === "ready" ? reportList.filter((r) => r.status === "unconfirmed").length : null, tone: "border-border-strong" },
    { key: "inForce", value: updates.state === "ready" ? updates.value.data.length : null, tone: "border-rail-fill" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p>{t("intro")}</p>

      <section aria-labelledby="overview-now" className="flex flex-col gap-2">
        <h2 id="overview-now" className="text-lg font-bold">
          {t("nowHeading")}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {tiles.map((tile) => (
            <li key={tile.key} className={`rounded-lg border-s-4 bg-elevated p-3 ${tile.tone}`}>
              <span className="block font-mono text-3xl font-bold tabular-nums" dir="ltr">
                {tile.value ?? "–"}
              </span>
              <span className="block text-sm">{t(`tiles.${tile.key}`)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-secondary">
          {runAt ? t("scoresFrom", { time: isolate(formatDayTime(new Date(runAt), locale)) }) : t("noScores")}
        </p>
      </section>

      <section aria-labelledby="overview-48h" className="flex flex-col gap-2">
        <h2 id="overview-48h" className="text-lg font-bold">
          {t("riskHeading")}
        </h2>
        <StripScreen />
      </section>

      {reports.state === "ready" && <RoadReports reports={reportList} />}

      <div className="flex flex-col gap-2">
        {updates.state === "ready" && <OfficialUpdates updates={updates.value.data} />}
        <Link href="/admin/updates" className={`${quietButtonClass} self-start`}>
          {t("postUpdate")}
        </Link>
      </div>

      <section aria-labelledby="overview-road" className="flex flex-col gap-2">
        <h2 id="overview-road" className="text-lg font-bold">
          {t("roadHeading")}
        </h2>
        <ul className="flex flex-col gap-2">
          {ROAD_ITEMS.map((item) => {
            const row = road.state === "ready" ? road.value.data.find((r) => r.item === item) : undefined;
            const state = row?.state ?? "unknown";
            return (
              <li key={item} className="rounded-lg border border-border bg-elevated p-3 text-sm">
                <p className="font-bold">{t(`road.${item}`)}</p>
                <p>
                  {t(`roadState.${state}`)}
                  {row && state !== "unknown" && (
                    <> · {t("roadSet", { time: isolate(formatDayTime(new Date(row.updated_at), locale)) })}</>
                  )}
                  {row?.source_url && /^https:\/\//.test(row.source_url) && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                        {t("source")}
                      </a>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
        {canEditRoad && (
          <Link href="/admin/road-status" className={`${quietButtonClass} self-start`}>
            {t("changeRoad")}
          </Link>
        )}
      </section>
    </div>
  );
}
