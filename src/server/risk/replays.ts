import "server-only";
import data from "@/lib/risk/replays.json";
import type { RiskRow } from "@/src/shared/risk";
import { withBoundaries, type HexFeature } from "./hexes";
import type { HexRow } from "./risk.repository";

// Storm replays (jobs/replay.py): real past storms from the verified
// incident list, scored with the weather that actually happened (ERA5), so
// a demo on a dry day can still show what the map does in bad weather.
// Read-only files in the build; never written to the live database.

type Event = (typeof data.events)[number];

export type ReplaySummary = {
  id: string;
  date: string; // incident date (IST), YYYY-MM-DD
  scored_at: string; // 12:00 IST on that date, as UTC
  zone_id: number;
  place: string;
  hazard: string;
  source_publisher: string;
  source_url: string;
};

export type Replay = ReplaySummary & { rows: RiskRow[]; hexes: HexFeature[] };

export const REPLAY_META = { model_version: data.model_version, weather_source: data.weather_source };

function summary(e: Event): ReplaySummary {
  const { id, date, scored_at, zone_id, place, hazard, source_publisher, source_url } = e;
  return { id, date, scored_at, zone_id, place, hazard, source_publisher, source_url };
}

export function listReplays(): ReplaySummary[] {
  return data.events.map(summary);
}

export function getReplay(id: string, horizon: number): Replay | null {
  const e = data.events.find((x) => x.id === id);
  if (!e) return null;
  return {
    ...summary(e),
    rows: e.rows as RiskRow[],
    hexes: withBoundaries(e.hexes.filter((h) => h.horizon_hours === horizon) as unknown as HexRow[]),
  };
}

export const REPLAY_CACHE_CONTROL = "public, max-age=3600";
