import { z } from "zod";
import { cleanText } from "@/src/server/schemas/common";

// Roles a user can ask for (BUILD_PROMPT section 8). TCU approves every
// request before the role works. admin is TCU itself and is never given in
// the app; the police role was merged into TCU (26 Nov 2026).
export const SELF_SERVICE_ROLES = ["grower", "trader", "agent", "driver"] as const;

export const LANGUAGES = ["en", "hi", "ur"] as const;

// POST /api/v1/me/onboarding
export const onboardingBody = z
  .object({
    role: z.enum(SELF_SERVICE_ROLES),
    display_name: cleanText(60).optional(),
    language: z.enum(LANGUAGES).optional(),
  })
  .strict();

export type OnboardingInput = z.infer<typeof onboardingBody>;

// PATCH /api/v1/me: your own name, language and location sharing. Turning
// location sharing on records the privacy notice version you agreed to (the
// server sets it; the client can't).
export const patchMeBody = z
  .object({
    display_name: cleanText(60).nullable().optional(),
    language: z.enum(LANGUAGES).optional(),
    location_consent: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Send at least one of display_name, language or location_consent." });

export type PatchMeInput = z.infer<typeof patchMeBody>;

// DELETE /api/v1/me: the body must say so, so a stray request can't do it.
export const deleteMeBody = z.object({ confirm: z.literal("DELETE") }).strict();

// PATCH /api/v1/admin/users/{id}/role: TCU moves an approved user between
// the self-service roles. admin and police can't be given.
export const roleChangeBody = z
  .object({
    role: z.enum(SELF_SERVICE_ROLES),
    reason: cleanText(500, { multiline: true }),
  })
  .strict();

export type RoleChangeInput = z.infer<typeof roleChangeBody>;

// A Clerk user id, the same rule as the users_id_is_clerk_id check.
export const clerkUserId = z.string().regex(/^user_[A-Za-z0-9]+$/);

export const APPROVALS = ["pending", "approved", "rejected"] as const;

// GET /api/v1/admin/users?approval=pending: the accounts TCU has to look at.
export const usersListQuery = z
  .object({
    approval: z.enum(["pending", "rejected"]).default("pending"),
  })
  .strict();

// POST /api/v1/admin/users/{id}/review: TCU approves or rejects a waiting
// account. A rejection needs a reason, which the person sees on /me.
export const reviewBody = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: cleanText(500, { multiline: true }).optional(),
  })
  .strict()
  .refine((v) => v.decision === "approved" || (v.note !== undefined && v.note.length > 0), {
    path: ["note"],
    message: "A rejection needs a reason.",
  });

export type ReviewInput = z.infer<typeof reviewBody>;
