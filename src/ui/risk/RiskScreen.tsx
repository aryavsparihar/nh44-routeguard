"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CorridorSegment, LngLat } from "@/src/shared/corridor";
import type { OfficialUpdate, PublicReport, RiskHex } from "@/src/shared/api-types";
import {
  HAZARDS,
  HORIZONS,
  levelFor,
  scoreFor,
  worstZone,
  type Hazard,
  type Horizon,
  type Level,
} from "@/src/shared/risk";
import { useApi, type ApiList } from "@/src/ui/api";
import { Icon, type IconName } from "@/src/ui/icons";
import { OfficialUpdates, RoadReports } from "./FeedLists";
import { RiskMap } from "./RiskMap";
import { LoadError, Loading } from "./states";
import { MAP_PLACES } from "@/src/shared/map-places";
import { useRisk } from "./useRisk";
import { ZoneList } from "./ZoneList";

const HAZARD_ICON: Record<Hazard, IconName> = {
  landslide: "hazard-landslide",
  rockfall: "hazard-rockfall",
  flash_flood: "hazard-flash-flood",
  snow_ice: "hazard-snow-ice",
};

const chip =
  "inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-elevated px-4 text-sm font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-inverse";

// The map screen (C1): pick a time and a hazard; see the worst zone, the
// map, the zone list, police/TCU updates and road reports. All of it comes
// from the public API.
export function RiskScreen({ segments, bounds }: { segments: CorridorSegment[]; bounds: [LngLat, LngLat] }) {
  const t = useTranslations("risk");
  const locale = useLocale();
  const risk = useRisk();
  const [reports] = useApi<ApiList<PublicReport>>("/api/v1/reports");
  const [updates] = useApi<ApiList<OfficialUpdate>>("/api/v1/official-updates");
  const [horizon, setHorizon] = useState<Horizon>(0);
  const [hazard, setHazard] = useState<Hazard | null>(null);

  const rows = useMemo(
    () => (risk.state === "ready" ? risk.rows.filter((r) => r.horizon_hours === horizon) : []),
    [risk, horizon],
  );
  const levels = useMemo(() => {
    const out: Record<number, Level> = {};
    for (const row of rows) out[row.zone_id] = scoreFor(row, hazard).level;
    return out;
  }, [rows, hazard]);
  const [hexRows] = useApi<ApiList<RiskHex>>(`/api/v1/risk/hexes?horizon=${horizon}`);
  const hexes = useMemo(
    () =>
      hexRows.state === "ready"
        ? hexRows.value.data.map((h) => ({ boundary: h.boundary, level: hazard ? levelFor(h.hazards[hazard]) : h.level }))
        : [],
    [hexRows, hazard],
  );
  const shownReports = useMemo(() => {
    const list = reports.state === "ready" ? reports.value.data : [];
    return hazard ? list.filter((r) => r.hazard_type === hazard) : list;
  }, [reports, hazard]);

  const when = horizon === 0 ? t("whenNow") : t("whenLater", { hours: horizon });

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("forecastTime")} className="flex gap-2 overflow-x-auto pb-1">
        {HORIZONS.map((h) => (
          <button key={h} type="button" className={chip} aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
            {t(`horizon.h${h}`)}
          </button>
        ))}
      </div>

      {risk.state === "loading" && <Loading />}
      {risk.state === "error" && <LoadError retry={risk.retry} />}
      {risk.state === "ready" && rows.length === 0 && <p className="rounded-md bg-surface p-3">{t("noScores")}</p>}

      {risk.state === "ready" && rows.length > 0 && (
        <>
          <WorstCard rows={rows} names={risk.names} hazard={hazard} when={when} />

          <div role="group" aria-label={t("hazardFilter")} className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" className={chip} aria-pressed={hazard === null} onClick={() => setHazard(null)}>
              {t("allHazards")}
            </button>
            {HAZARDS.map((h) => (
              <button key={h} type="button" className={chip} aria-pressed={hazard === h} onClick={() => setHazard(h)}>
                <Icon name={HAZARD_ICON[h]} className="size-5" />
                {t(`hazard.${h}`)}
              </button>
            ))}
          </div>

          <RiskMap
            segments={segments}
            bounds={bounds}
            levels={levels}
            reports={shownReports}
            label={t("mapLabel", { when })}
            failedText={t("mapFailed")}
            hexes={hexes}
            placeLabels={
              locale === "en"
                ? undefined
                : MAP_PLACES.map((p) => ({ name: t(`mapPlaces.${p.id}`), lng: p.lng, lat: p.lat }))
            }
          />
          <Legend />

          <section aria-labelledby="zones-heading" className="flex flex-col gap-2">
            <h2 id="zones-heading" className="text-lg font-bold">
              {t("zonesHeading")}
            </h2>
            <ZoneList rows={rows} names={risk.names} hazard={hazard} />
          </section>
        </>
      )}

      {updates.state === "ready" && <OfficialUpdates updates={updates.value.data} />}
      {reports.state === "ready" && <RoadReports reports={shownReports} />}
    </div>
  );
}

function WorstCard({
  rows,
  names,
  hazard,
  when,
}: {
  rows: Parameters<typeof worstZone>[0];
  names: Record<number, string>;
  hazard: Hazard | null;
  when: string;
}) {
  const t = useTranslations("risk");
  const worst = worstZone(rows, hazard);
  let text: string;
  if (worst.kind === "all_low") {
    text = hazard ? t("allLowHazard", { hazard: t(`hazard.${hazard}`), when }) : t("allLow", { when });
  } else {
    const { score, level } = scoreFor(worst.row, hazard);
    const values = {
      when,
      zone: worst.row.zone_id,
      name: names[worst.row.zone_id] ?? "",
      level: t(`level.${level}`),
      score: score.toFixed(2),
    };
    text = hazard ? t("worstHazard", { ...values, hazard: t(`hazard.${hazard}`) }) : t("worst", values);
  }
  const tone =
    worst.kind === "all_low"
      ? "border-send-fill bg-send-bg text-send-text"
      : scoreFor(worst.row, hazard).level === "high"
        ? "border-high-fill bg-high-bg text-high-text"
        : "border-hold-fill bg-hold-bg text-hold-text";
  return (
    <p aria-live="polite" className={`rounded-lg border-s-4 p-3 font-bold ${tone}`}>
      {text}
    </p>
  );
}

function Legend() {
  const t = useTranslations("risk");
  const items: { level: Level; width: string; color: string }[] = [
    { level: "low", width: "h-1", color: "bg-risk-low" },
    { level: "medium", width: "h-1.5", color: "bg-risk-medium" },
    { level: "high", width: "h-2.5", color: "bg-risk-high" },
  ];
  return (
    <div className="flex flex-col gap-1 text-sm">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label={t("legendTitle")}>
        {items.map((i) => (
          <li key={i.level} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block w-6 rounded-full ${i.width} ${i.color}`} />
            {t(`level.${i.level}`)}
          </li>
        ))}
      </ul>
      <p className="text-secondary">{t("lineNote")}</p>
      <p className="text-secondary">{t("hexNote")}</p>
    </div>
  );
}
