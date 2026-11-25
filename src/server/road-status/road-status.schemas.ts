import { z } from "zod";
import { cleanText } from "@/src/server/schemas/common";
import { httpsUrl } from "@/src/server/schemas/https-url";

export const ROAD_ITEMS = ["mughal_road", "rail_parcel"] as const;
export const ROAD_STATES = ["open", "closed", "unknown"] as const;

// PATCH /api/v1/admin/road-status: one item at a time. "open" and "closed"
// need the link that says so; "unknown" clears it (the advice then says
// "check with TCU / Northern Railway").
export const roadStatusBody = z
  .object({
    item: z.enum(ROAD_ITEMS),
    state: z.enum(ROAD_STATES),
    source_url: httpsUrl.nullable().default(null),
    reason: cleanText(500, { multiline: true }).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.state !== "unknown" && value.source_url === null) {
      ctx.addIssue({ code: "custom", path: ["source_url"], message: "Add the link that says it is open or closed." });
    }
    if (value.state === "unknown" && value.source_url !== null) {
      ctx.addIssue({ code: "custom", path: ["source_url"], message: "Leave the link empty for unknown." });
    }
  });

export type RoadStatusInput = z.infer<typeof roadStatusBody>;
