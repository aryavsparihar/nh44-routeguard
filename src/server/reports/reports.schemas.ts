import { z } from "zod";
import { cleanText, corridorLat, corridorLng } from "@/src/server/schemas/common";
import { REPORT_RULES } from "./rules";

export const HAZARDS = ["landslide", "rockfall", "flash_flood", "snow_ice", "accident", "other"] as const;
export const FLAG_REASONS = ["not_there", "wrong_place", "duplicate", "offensive", "other"] as const;

export const reportId = z.uuid();

// The Idempotency-Key header of POST /api/v1/reports: a UUID the phone makes
// once per report and sends again on every retry. It becomes the report's
// client_id, so a retry can never make a second report.
export const idempotencyKey = z.uuid();

// The text fields of the multipart form (the photo is checked on its own).
// Numbers arrive as text in a form, so they are coerced first.
export const reportFields = z
  .object({
    hazard_type: z.enum(HAZARDS),
    lat: z.coerce.number().pipe(corridorLat),
    lng: z.coerce.number().pipe(corridorLng),
    note: cleanText(REPORT_RULES.note_max_chars, { multiline: true }).optional(),
  })
  .strict();

export type ReportFields = z.infer<typeof reportFields>;

// POST /api/v1/reports/{id}/confirm: where you are now, if the phone knows.
// Only the distance to the report is kept.
export const confirmBody = z
  .object({
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .strict()
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: "Send both lat and lng, or neither." });

// POST /api/v1/reports/{id}/flag
export const flagBody = z.object({ reason: z.enum(FLAG_REASONS) }).strict();

// PATCH /api/v1/admin/reports/{id}
export const MODERATION_ACTIONS = ["hide", "resolve", "restore"] as const;
export const moderateBody = z
  .object({ action: z.enum(MODERATION_ACTIONS), reason: cleanText(280, { multiline: true }) })
  .strict();

export type ModerateInput = z.infer<typeof moderateBody>;

// GET /api/v1/admin/reports?status=&limit=&cursor=
export const ADMIN_STATUSES = ["unconfirmed", "confirmed", "expired", "resolved", "hidden"] as const;
export const adminReportsQuery = z
  .object({
    status: z.enum(ADMIN_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z
      .string()
      .regex(/^\d{1,15}_[0-9a-f-]{36}$/, "Not a cursor from this API.")
      .transform((c) => {
        const [ms, id] = c.split("_");
        return { createdAt: new Date(Number(ms)), id };
      })
      .optional(),
  })
  .strict();
