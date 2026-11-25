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

export const hexQuery = z
  .object({
    horizon: z.enum(["0", "12", "24", "48"]).default("0").transform(Number),
  })
  .strict();

// A storm replay is named by its incident id, like inc-2026-01-23-z5-snow_ice
// (data/incidents.csv). Anything else is a 404 before it is looked up.
export const replayId = z.string().regex(/^inc-\d{4}-\d{2}-\d{2}-z[1-6]-[a-z_]{4,12}$/);
