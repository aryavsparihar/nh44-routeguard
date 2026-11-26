"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Replay, RiskHex } from "@/src/shared/api-types";
import {
  DEPARTURES,
  LAST_HOUR,
  TRAVEL_HOURS,
  cellsAlongRoad,
  fewestHigh,
  planDepartures,
  type LevelsByHorizon,
} from "@/src/shared/departure";
import { HORIZONS, type Horizon, type Level } from "@/src/shared/risk";
import { useApi, type ApiList } from "@/src/ui/api";

const FILL: Record<Level, string> = {
  low: "var(--color-risk-low)",
  medium: "var(--color-risk-medium)",
  high: "var(--color-risk-high)",
};
// The time each forecast stands for on the ribbon (nearest-time rule in
// src/shared/departure.ts): now 0–6 h, +12 6–18 h, +24 18–36 h, +48 36–48 h.
const BAND: Record<Horizon, [number, number]> = { 0: [0, 6], 12: [6, 18], 24: [18, 36], 48: [36, 48] };
const W = 300;
const H = 160;

// The cells at every forecast time: today's, or a past storm's in replay mode.
function useAllHorizons(replayId: string | null) {
  const path = (h: Horizon) =>
    replayId ? `/api/v1/risk/replays/${encodeURIComponent(replayId)}?horizon=${h}` : `/api/v1/risk/hexes?horizon=${h}`;
  const a = useApi<ApiList<RiskHex> | { data: Replay }>(path(0));
  const b = useApi<ApiList<RiskHex> | { data: Replay }>(path(12));
  const c = useApi<ApiList<RiskHex> | { data: Replay }>(path(24));
  const d = useApi<ApiList<RiskHex> | { data: Replay }>(path(48));
  const loaded = [a[0], b[0], c[0], d[0]];
  if (loaded.some((l) => l.state === "error")) return { state: "error" as const };
  if (loaded.some((l) => l.state === "loading")) return { state: "loading" as const };
  const byH = {} as Record<Horizon, RiskHex[]>;
  HORIZONS.forEach((h, i) => {
    const l = loaded[i];
    if (l.state !== "ready") return;
    const v = l.value.data;
    byH[h] = Array.isArray(v) ? v : v.hexes;
  });
  return { state: "ready" as const, byH };
}

// "When to leave": the road's H3 cells in order (Srinagar → Jammu) against
// the next 48 hours, with a line for each departure time and one sentence of
// result for each (src/shared/departure.ts).
export function DepartureRibbon({ replayId }: { replayId: string | null }) {
  const t = useTranslations("risk.ribbon");
  const all = useAllHorizons(replayId);

  const model = useMemo(() => {
    if (all.state !== "ready") return null;
    const base = all.byH[0] ?? [];
    if (base.length === 0) return null;
    const cells = cellsAlongRoad(base.map((h) => ({ id: h.h3_index, zone: h.zone_id, boundary: h.boundary })));
    const levels: LevelsByHorizon = {};
    for (const h of HORIZONS) levels[h] = new Map((all.byH[h] ?? []).map((x) => [x.h3_index, x.level]));
    const plans = planDepartures(cells, levels);
    return { cells, levels, plans, best: fewestHigh(plans) };
  }, [all]);

  if (all.state === "loading") return <p role="status">{t("loading")}</p>;
  if (all.state === "error" || !model) return <p className="rounded-md bg-surface p-3">{t("noCells")}</p>;

  const { cells, levels, plans, best } = model;
  const colW = W / cells.length;
  const y = (hours: number) => (hours / LAST_HOUR) * H;
  const when = (d: number) => (d === 0 ? t("now") : t("later", { hours: d }));

  return (
    <section aria-labelledby="ribbon-heading" className="flex flex-col gap-2 rounded-lg border border-border bg-elevated p-3">
      <h2 id="ribbon-heading" className="text-lg font-bold">
        {t("heading")}
      </h2>
      <p className="text-sm">{t("intro")}</p>
      {/* A picture of the list below: the road always runs Srinagar → Jammu left to right, in every language. */}
      <div dir="ltr" className="flex flex-col gap-1">
        <div className="flex justify-between text-xs font-bold">
          <span>{t("srinagar")}</span>
          <span>{t("jammu")}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("svgLabel")} className="h-auto w-full rounded-sm">
          {HORIZONS.map((h) =>
            cells.map((cell, i) => {
              const level = levels[h]?.get(cell.id);
              const [from, to] = BAND[h];
              return (
                <rect
                  key={`${h}-${cell.id}`}
                  x={i * colW}
                  y={y(from)}
                  width={colW + 0.05}
                  height={y(to) - y(from)}
                  fill={level ? FILL[level] : "var(--color-surface)"}
                  opacity={0.85}
                />
              );
            }),
          )}
          {DEPARTURES.map((d) => (
            <g key={d}>
              <line x1={0} y1={y(d)} x2={W} y2={y(d + TRAVEL_HOURS)} stroke="white" strokeWidth={2.5} />
              <line x1={0} y1={y(d)} x2={W} y2={y(d + TRAVEL_HOURS)} stroke="black" strokeWidth={1} strokeDasharray={best.some((b) => b.depart === d) ? undefined : "3 2"} />
            </g>
          ))}
        </svg>
        <div className="flex justify-between text-xs text-secondary">
          <span>{t("hours", { hours: 0 })}</span>
          <span>{t("hours", { hours: LAST_HOUR })}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {plans.map((p) => (
          <li key={p.depart} className={best.some((b) => b.depart === p.depart) ? "font-bold" : undefined}>
            {p.high === 0 && p.medium === 0
              ? t("clear", { when: when(p.depart) })
              : t("result", { when: when(p.depart), high: p.high, medium: p.medium })}
            {p.unknown > 0 && ` ${t("unknown", { count: p.unknown })}`}
          </li>
        ))}
      </ul>
      {best.length > 0 && <p className="font-bold">{t("fewest", { when: best.map((b) => when(b.depart)).join(", ") })}</p>}
      <p className="text-xs text-secondary">{t("assumption", { hours: TRAVEL_HOURS })}</p>
    </section>
  );
}
