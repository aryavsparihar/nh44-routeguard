import "server-only";
import type { Database } from "@/lib/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

// Who is making the request. role is null for a signed-in user who hasn't
// picked a role yet (onboarding).
export type Caller = { userId: string; role: Role | null };

// TODO(A2): read the Clerk session here:
//   const { userId, sessionClaims } = await auth();
//   role comes from sessionClaims.metadata.role (Clerk publicMetadata).
// Until Clerk is wired in, everyone is signed out, so protected routes
// answer 401. That is the honest answer while there is no login.
export async function getCaller(): Promise<Caller | null> {
  return null;
}
