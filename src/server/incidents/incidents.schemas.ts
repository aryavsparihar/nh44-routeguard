import { z } from "zod";
import { zoneParam } from "@/src/server/schemas/zone-query";

// ?zone=3&limit=20&cursor=... Cursor = the last row's date and id, so the
// next page starts after it even when rows share a date.
export const incidentsQuery = z
  .object({
    zone: zoneParam.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}_\d{1,12}$/, "Not a cursor from this API.")
      .transform((c) => {
        const [date, id] = c.split("_");
        return { date, id: Number(id) };
      })
      .optional(),
  })
  .strict();

export function incidentCursor(row: { date: string; id: number }): string {
  return `${row.date}_${row.id}`;
}
