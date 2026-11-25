import { z } from "zod";

// GET /api/v1/admin/audit-log?limit=&cursor=&action=. Newest first. The
// cursor is the last row's id (ids only grow). action filters on one exact
// action name like "official_update.deleted".
export const auditLogQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z
      .string()
      .regex(/^\d{1,15}$/, "Not a cursor from this API.")
      .transform(Number)
      .optional(),
    action: z
      .string()
      .regex(/^[a-z_]{1,40}\.[a-z_]{1,19}$/, "Not an action name.")
      .optional(),
  })
  .strict();
