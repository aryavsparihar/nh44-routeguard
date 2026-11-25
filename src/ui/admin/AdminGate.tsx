import type { ReactNode } from "react";
import { requirePageRole } from "@/src/server/auth/page";
import type { Caller, Role } from "@/src/server/http/caller";

// The page-level role check for the admin pages (two locks: this, and
// withApi() on every admin API route, then RLS in the database). Signed out:
// sign-in. Wrong role: the 404 page. It reads the session, so pages render it
// inside <Suspense> (cacheComponents).
export async function AdminGate({
  roles,
  children,
}: {
  roles: Role[];
  children: (caller: Caller) => ReactNode;
}) {
  const caller = await requirePageRole(roles);
  return <>{children(caller)}</>;
}
