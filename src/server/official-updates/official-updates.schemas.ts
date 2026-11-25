import { z } from "zod";
import { cleanText } from "@/src/server/schemas/common";
import { httpsUrl } from "@/src/server/schemas/https-url";

// Same values as the official_update_kind enum in the database.
export const UPDATE_KINDS = ["closure", "one_way", "reopened", "advisory"] as const;

// A time with its offset, like 2026-11-26T09:30:00+05:30 or ...Z.
const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

// The id in /api/v1/admin/official-updates/{id}.
export const updateId = z.uuid();

// 1..6, or null for the whole road.
const zoneId = z.number().int().min(1).max(6).nullable();

const fields = {
  zone_id: zoneId,
  kind: z.enum(UPDATE_KINDS),
  title: cleanText(120),
  body: cleanText(1000, { multiline: true }).nullable(),
  source_url: httpsUrl,
  source_name: cleanText(120),
  issued_at: instant,
  valid_until: instant,
};

// An update can't be issued in the future (a little slack for clock drift)
// and must end after it starts.
const CLOCK_SLACK_MS = 10 * 60_000;

export function windowErrors(
  issuedAt: Date,
  validUntil: Date,
  now: number = Date.now(),
): { path: string; message: string }[] {
  const errors = [];
  if (issuedAt.getTime() > now + CLOCK_SLACK_MS) {
    errors.push({ path: "issued_at", message: "Can't be in the future." });
  }
  if (validUntil.getTime() <= issuedAt.getTime()) {
    errors.push({ path: "valid_until", message: "Must be after issued_at." });
  }
  return errors;
}

// POST /api/v1/admin/official-updates
export const createUpdateBody = z
  .object({ ...fields, zone_id: zoneId.default(null), body: fields.body.default(null) })
  .strict()
  .superRefine((value, ctx) => {
    // zod still runs this when a time failed to parse; then the field's own
    // error is enough.
    if (!(value.issued_at instanceof Date) || !(value.valid_until instanceof Date)) return;
    for (const e of windowErrors(value.issued_at, value.valid_until)) {
      ctx.addIssue({ code: "custom", path: [e.path], message: e.message });
    }
    if (value.valid_until.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", path: ["valid_until"], message: "Already over. Pick a later time." });
    }
  });

export type CreateUpdateInput = z.infer<typeof createUpdateBody>;

// PATCH /api/v1/admin/official-updates/{id}: any of the fields, plus an
// optional reason for the audit log. It makes a new version; the old one is
// kept (soft deleted, "replaced by version n").
export const editUpdateBody = z
  .object({
    zone_id: fields.zone_id.optional(),
    kind: fields.kind.optional(),
    title: fields.title.optional(),
    body: fields.body.optional(),
    source_url: fields.source_url.optional(),
    source_name: fields.source_name.optional(),
    issued_at: fields.issued_at.optional(),
    valid_until: fields.valid_until.optional(),
    reason: cleanText(500, { multiline: true }).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "reason"), {
    message: "Change at least one field.",
  });

export type EditUpdateInput = z.infer<typeof editUpdateBody>;
export type UpdatePatch = Omit<EditUpdateInput, "reason">;

// DELETE /api/v1/admin/official-updates/{id}: a soft delete, always with a
// reason (shown in the history and the audit log).
export const deleteUpdateBody = z.object({ reason: cleanText(280, { multiline: true }) }).strict();

// GET /api/v1/admin/official-updates?limit=&cursor=: every version, newest
// first, deleted ones too. Cursor = the last row's created_at (ms) and id.
export const adminUpdatesQuery = z
  .object({
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

export function updateCursor(row: { created_at: Date; id: string }): string {
  return `${row.created_at.getTime()}_${row.id}`;
}
