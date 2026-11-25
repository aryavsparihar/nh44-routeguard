// POST /api/v1/advice body. Ranges as in the app (BUILD_PROMPT section 6):
// tonnes 0.1–40, days since picking 0–120. Unknown fields are a 422.
import { z } from "zod";
import { DESTINATIONS, VARIETIES } from "@/src/shared/priority";

export const adviceRequest = z
  .object({
    variety: z.enum(VARIETIES as [string, ...string[]]),
    days_since_picking: z.number().int().min(0).max(120),
    tonnes: z.number().min(0.1).max(40),
    destination: z.enum(DESTINATIONS as [string, ...string[]]),
    truck_type: z.enum(["light", "heavy"]),
  })
  .strict();
