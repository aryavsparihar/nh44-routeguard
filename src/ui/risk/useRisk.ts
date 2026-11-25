"use client";

import { useApi, type ApiList } from "@/src/ui/api";
import type { Zone } from "@/src/shared/api-types";
import type { RiskMeta, RiskRow } from "@/src/shared/risk";

// Everything the map and the 48 h strip need: all rows of the newest run and
// the zone names. Two requests, both cached by the browser and the server.
export function useRisk() {
  const [risk, retryRisk] = useApi<ApiList<RiskRow, RiskMeta>>("/api/v1/risk");
  const [zones, retryZones] = useApi<ApiList<Zone>>("/api/v1/zones");
  const retry = () => {
    retryRisk();
    retryZones();
  };
  if (risk.state === "error" || zones.state === "error") return { state: "error" as const, retry };
  if (risk.state === "loading" || zones.state === "loading") return { state: "loading" as const, retry };
  const names: Record<number, string> = {};
  for (const z of zones.value.data) names[z.id] = z.name;
  return { state: "ready" as const, rows: risk.value.data, meta: risk.value.meta, names, retry };
}
