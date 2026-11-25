import "server-only";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { isClerkConfigured } from "@/lib/clerk/env";
import { roleFromClaims, type Caller, type Role } from "@/src/server/http/caller";

// The real access check for a page, at the top of its server component:
//
//   export default async function AdminPage() {
//     const caller = await requirePageRole(["admin"]);
//     ...
//   }
//
// Signed out: sent to sign-in. Wrong role (or no role yet): the 404 page, so
// the page doesn't even admit it exists. (Next 16's forbidden() is still
// experimental, so we don't use it.) Pages that read auth sit inside
// <Suspense> because cacheComponents is on.
export async function requirePageRole(roles: Role[]): Promise<Caller> {
  if (!isClerkConfigured()) notFound();

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const role = roleFromClaims(sessionClaims);
  if (!role || !roles.includes(role)) notFound();

  return { userId, role };
}

// For pages any signed-in user may open (the report screen): signed out goes
// to sign-in; the role (null before onboarding) comes back for the page to
// decide what to show.
export async function requirePageSignIn(): Promise<Caller> {
  if (!isClerkConfigured()) notFound();
  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  return { userId, role: roleFromClaims(sessionClaims) };
}
