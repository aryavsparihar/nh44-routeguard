// Runs before every matched request (Next.js 16 calls middleware "proxy").
//
// With Clerk keys set, clerkMiddleware() reads the session cookie or the
// "Authorization: Bearer <token>" header so that auth() works everywhere,
// and sends signed-out visitors of protected pages (/board, /report/new,
// /admin/...) to sign-in.
//
// This is the quick first check. The real checks sit next to the data:
// withApi() on every API route (401/403 as problem+json) and
// requirePageRole() on every protected page. We don't use Clerk's
// createRouteMatcher (deprecated in @clerk/nextjs 7) and we don't protect API
// paths here, because auth.protect() would answer a signed-out API call with
// 404 instead of our 401.
//
// Without keys (CI, a fresh clone), requests pass straight through.
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/clerk/env";
import { isProtectedPage } from "@/src/server/auth/protected-pages";

const passThrough = () => NextResponse.next();

export default isClerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedPage(req.nextUrl.pathname)) {
        await auth.protect();
      }
    })
  : passThrough;

// From Clerk's Next.js quickstart: skip Next internals and static files,
// always run for API routes and Clerk's own /__clerk paths.
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
