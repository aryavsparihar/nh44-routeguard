"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatReason, type ReasonTranslate } from "@/src/shared/reason";
import type { CorridorSegment, LngLat } from "@/src/shared/corridor";
import type { OfficialUpdate, PublicReport, Replay, ReplaySummary, RiskHex } from "@/src/shared/api-types";
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
import { HexCard, type PickedHex } from "./HexCard";
import { OfficialUpdates, RoadReports } from "./FeedLists";
import { ReplayBanner, ReplayPicker, useReplayText } from "./Replay";
import { RiskMap } from "./RiskMap";
import { LoadError, Loading } from "./states";
import { MAP_PLACES } from "@/src/shared/map-places";
import { useMapSignal } from "./useMapSignal";
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
  const tr = useTranslations("reason");
  const locale = useLocale();
  const live = useRisk();
  const [reports, , refreshReports] = useApi<ApiList<PublicReport>>("/api/v1/reports");
  const [updates, , refreshUpdates] = useApi<ApiList<OfficialUpdate>>("/api/v1/official-updates");
  // New reports and updates appear without a reload (D4b).
  const refreshFeeds = useCallback(() => {
    refreshReports();
    refreshUpdates();
  }, [refreshReports, refreshUpdates]);
  useMapSignal(refreshFeeds);
  const [horizon, setHorizon] = useState<Horizon>(0);
  const [hazard, setHazard] = useState<Hazard | null>(null);

  // A past storm instead of today (jobs/replay.py), for demos on a dry day.
  // Its zone rows and cells replace the live ones; zone names stay live.
  const [replays] = useApi<ApiList<ReplaySummary>>("/api/v1/risk/replays");
  const replayList = replays.state === "ready" ? replays.value.data : [];
  const [replayId, setReplayId] = useState<string | null>(null);
  const replayInfo = replayList.find((r) => r.id === replayId) ?? null;
  const [replay, retryReplay] = useApi<{ data: Replay }>(
    replayInfo ? `/api/v1/risk/replays/${encodeURIComponent(replayInfo.id)}?horizon=${horizon}` : null,
  );
  // The hook keeps the last answer while the next loads: never show one
  // storm under another's banner.
  const replayData = replayInfo && replay.state === "ready" && replay.value.data.id === replayInfo.id ? replay.value.data : null;
  const risk = useMemo(() => {
    if (!replayInfo || live.state !== "ready") return live;
    if (replay.state === "error") return { state: "error" as const, retry: retryReplay };
    if (!replayData) return { state: "loading" as const, retry: retryReplay };
    return { ...live, rows: replayData.rows };
  }, [live, replayInfo, replay.state, replayData, retryReplay]);
  const replayText = useReplayText();

  const rows = useMemo(
    () => (risk.state === "ready" ? risk.rows.filter((r) => r.horizon_hours === horizon) : []),
    [risk, horizon],
  );
  const levels = useMemo(() => {
    const out: Record<number, Level> = {};
    for (const row of rows) out[row.zone_id] = scoreFor(row, hazard).level;
    return out;
  }, [rows, hazard]);
  const [liveHexes] = useApi<ApiList<RiskHex>>(replayInfo ? null : `/api/v1/risk/hexes?horizon=${horizon}`);
  const hexList = useMemo((): RiskHex[] | null => {
    if (replayInfo) return replayData ? replayData.hexes : null;
    return liveHexes.state === "ready" ? liveHexes.value.data : null;
  }, [replayInfo, replayData, liveHexes]);
  const hexes = useMemo(
    () =>
      hexList
        ? hexList.map((h) => ({
            id: h.h3_index,
            boundary: h.boundary,
            level: hazard ? levelFor(h.hazards[hazard]) : h.level,
          }))
        : [],
    [hexList, hazard],
  );
  // The cell tapped on the map. Its numbers follow the time and hazard
  // picked above, like the map's colours.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = useMemo((): PickedHex | null => {
    if (!pickedId || !hexList || risk.state !== "ready") return null;
    const h = hexList.find((x) => x.h3_index === pickedId);
    if (!h) return null;
    const score = hazard ? h.hazards[hazard] : (h.overall ?? 0);
    return {
      id: h.h3_index,
      zone: h.zone_id,
      zoneName: h.zone_id === null ? "" : (risk.names[h.zone_id] ?? ""),
      level: hazard ? levelFor(score) : h.level,
      score,
      topHazard: h.top_hazard ?? null,
      // ?? null: a copy saved before these fields existed (the HTTP cache or
      // the service worker) has them undefined; show "Not known", not a crash.
      slope: typeof h.slope_deg === "number" ? h.slope_deg : null,
      confidence: h.confidence ?? null,
      reason: formatReason(
        {
          reason: h.reason ?? "",
          reason_code: h.reason_code ?? null,
          reason_params: h.reason_params ?? null,
          top_hazard: (h.top_hazard as Hazard | null) ?? null,
        },
        ((key, values) => tr(key as never, values as never)) as ReasonTranslate,
      ),
    };
  }, [pickedId, hexList, risk, hazard, tr]);
  const shownReports = useMemo(() => {
    const list = reports.state === "ready" ? reports.value.data : [];
    return hazard ? list.filter((r) => r.hazard_type === hazard) : list;
  }, [reports, hazard]);

  const places = useMemo(
    () => MAP_PLACES.map((p) => ({ name: t(`mapPlaces.${p.id}`), lng: p.lng, lat: p.lat })),
    [t],
  );

  const when = replayInfo
    ? horizon === 0
      ? t("replay.whenAt", { date: replayText.date(replayInfo) })
      : t("replay.whenLater", { hours: horizon, date: replayText.date(replayInfo) })
    : horizon === 0
      ? t("whenNow")
      : t("whenLater", { hours: horizon });

  return (
    <div className="flex flex-col gap-4">
      <ReplayPicker replays={replayList} value={replayInfo ? replayInfo.id : null} onChange={setReplayId} />
      {replayInfo && <ReplayBanner replay={replayInfo} onBack={() => setReplayId(null)} />}

      <div role="group" aria-label={t("forecastTime")} className="flex gap-2 overflow-x-auto pb-1">
        {HORIZONS.map((h) => (
          <button key={h} type="button" className={chip} aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
            {replayInfo ? t(`replay.horizon.h${h}`) : t(`horizon.h${h}`)}
          </button>
        ))}
      </div>

      {risk.state === "loading" && <Loading />}
      {risk.state === "error" && <LoadError retry={risk.retry} />}
      {risk.state === "ready" && rows.length === 0 && <p className="rounded-md bg-surface p-3">{t("noScores")}</p>}

      {risk.state === "ready" && rows.length > 0 && (
        <>
          <WorstCard rows={rows} names={risk.names} hazard={hazard} when={when} />
          {/* A calm day scores every zone low. Offer a real past storm so the map can be seen working. */}
          {!replayInfo && replayList.length > 0 && worstZone(rows, hazard).kind === "all_low" && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>{t("replay.lowHint")}</span>
              <button
                type="button"
                className="min-h-11 font-bold text-primary underline"
                onClick={() => setReplayId(replayList[0].id)}
              >
                {t("replay.lowShow")}
              </button>
            </p>
          )}

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
            reports={replayInfo ? [] : shownReports}
            label={t("mapLabel", { when })}
            simpleText={t("mapSimple")}
            hexes={hexes}
            places={places}
            baseLabels={locale === "en"}
            pickedHex={picked ? picked.id : null}
            onPickHex={setPickedId}
          />
          {picked && <HexCard cell={picked} when={when} onClose={() => setPickedId(null)} />}
          <Legend />

          <section aria-labelledby="zones-heading" className="flex flex-col gap-2">
            <h2 id="zones-heading" className="text-lg font-bold">
              {t("zonesHeading")}
            </h2>
            <ZoneList rows={rows} names={risk.names} hazard={hazard} />
          </section>
        </>
      )}

      {/* Today's reports and updates don't belong on a past storm's map. */}
      {!replayInfo && updates.state === "ready" && <OfficialUpdates updates={updates.value.data} />}
      {!replayInfo && reports.state === "ready" && <RoadReports reports={shownReports} />}
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
