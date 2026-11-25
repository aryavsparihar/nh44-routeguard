import "server-only";
import type { Db } from "@/src/server/db";
import type { RoadState, RoadStatus } from "@/src/shared/decide";
import { listRoadStatus } from "./road-status.repository";

// A missing row counts as unknown: the advice then says "check with TCU /
// Northern Railway" instead of assuming the road or train is available.
export function toRoadStatus(rows: { item: string; state: RoadState }[]): RoadStatus {
  const state = (item: string): RoadState => rows.find((r) => r.item === item)?.state ?? "unknown";
  return { mughal_road: state("mughal_road"), rail_parcel: state("rail_parcel") };
}

export async function getRoadStatus(db: Db): Promise<RoadStatus> {
  return toRoadStatus(await listRoadStatus(db));
}
