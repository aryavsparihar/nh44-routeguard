// An agent's fleet: invite codes, joining, vouching (D4, section 11).
import { z } from "zod";

// 8 characters from the 32 that can't be confused (no I, O, 0, 1). Typed
// codes are trimmed, uppercased and may contain a space or dash.
export const inviteCode = z
  .string()
  .max(20)
  .transform((c) => c.replace(/[\s-]/g, "").toUpperCase())
  .refine((c) => /^[A-HJ-NP-Z2-9]{8}$/.test(c), "Not an invite code. It has 8 letters and digits.");

export const acceptInviteBody = z.object({ code: inviteCode }).strict();
export const createInviteBody = z.object({ days: z.number().int().min(1).max(30).default(7) }).strict();
