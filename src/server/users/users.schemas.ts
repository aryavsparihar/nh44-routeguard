import { z } from "zod";
import { ROLES } from "@/src/server/http/caller";
import { cleanText } from "@/src/server/schemas/common";

// Roles a user can pick for themselves (BUILD_PROMPT section 8). police and
// admin are never on this list: only an admin grants them.
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

// PATCH /api/v1/admin/users/{id}/role
export const roleChangeBody = z
  .object({
    role: z.enum(ROLES),
    reason: cleanText(500, { multiline: true }),
  })
  .strict();

export type RoleChangeInput = z.infer<typeof roleChangeBody>;

// A Clerk user id, the same rule as the users_id_is_clerk_id check.
export const clerkUserId = z.string().regex(/^user_[A-Za-z0-9]+$/);
