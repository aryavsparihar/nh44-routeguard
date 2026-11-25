// Query strings for the risk routes. Bad input is a 400 (L7): ?zone=abc
// must never quietly return everything.
import { z } from "zod";
import { zoneParam } from "@/src/server/schemas/zone-query";

export const riskQuery = z
  .object({
    horizon: z.enum(["0", "12", "24", "48"]).transform(Number).optional(),
    zone: zoneParam.optional(),
  })
  .strict();

export const summaryQuery = z
  .object({
    lang: z.enum(["en", "hi", "ur"]).default("en"),
  })
  .strict();
