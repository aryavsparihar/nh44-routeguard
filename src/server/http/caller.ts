import "server-only";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { isClerkConfigured } from "@/lib/clerk/env";

export type Role = Database["public"]["Enums"]["user_role"];

// Who is making the request. role is null for a signed-in user who hasn't
// picked a role yet (onboarding).
export type Caller = { userId: string; role: Role | null };

// Same list as the user_role enum in the database.
export const ROLES = ["grower", "trader", "agent", "driver", "police", "admin"] as const satisfies readonly Role[];
const roleSchema = z.enum(ROLES);

// The role lives in Clerk publicMetadata.role, which users can't change from
// the browser. The session token carries it as metadata.role once the
// dashboard step "customise session token" is done (docs/runbook.md).
// Anything that isn't exactly one of our roles counts as "no role", so a
// broken or unexpected claim can never grant access.
export function roleFromClaims(claims: unknown): Role | null {
  const metadata = (claims as { metadata?: { role?: unknown } } | null)?.metadata;
  const result = roleSchema.safeParse(metadata?.role);
  return result.success ? result.data : null;
}

export async function getCaller(): Promise<Caller | null> {
  if (!isClerkConfigured()) return null;

  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  return { userId, role: roleFromClaims(sessionClaims) };
}
