import { describe, expect, it } from "vitest";
import type { PublicReport } from "@/src/shared/api-types";
import { sortForReview } from "./ControlRoom";

const report = (id: string, status: PublicReport["status"], created_at: string): PublicReport => ({
  id, status, created_at, source: "driver", hazard_type: "landslide", lat: 33.25, lng: 75.19, zone_id: 4,
  note: null, confirmations: 0, expires_at: created_at, has_photo: false, is_demo: true,
});

describe("sortForReview", () => {
  it("puts reports waiting for confirmation first, newest first within each", () => {
    const list = [
      report("c-old", "confirmed", "2026-11-26T06:00:00Z"),
      report("u-old", "unconfirmed", "2026-11-26T05:00:00Z"),
      report("c-new", "confirmed", "2026-11-26T09:00:00Z"),
      report("u-new", "unconfirmed", "2026-11-26T08:00:00Z"),
    ];
    expect(sortForReview(list).map((r) => r.id)).toEqual(["u-new", "u-old", "c-new", "c-old"]);
    expect(list[0].id).toBe("c-old"); // the input is not changed
  });
});
