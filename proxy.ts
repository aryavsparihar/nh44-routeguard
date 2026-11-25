// Runs before every matched request (Next.js 16 calls middleware "proxy").
//
// 1. Clerk (when keys are set): clerkMiddleware() reads the session cookie or
//    the "Authorization: Bearer <token>" header so that auth() works
//    everywhere, and sends signed-out visitors of protected pages (/board,
//    /report/new, /me, /admin/...) to our /sign-in page.
// 2. Language: for pages (not /api), next-intl picks the language from the
//    rg_lang cookie (or the phone's language on a first visit) and rewrites
//    /board to /ur/board inside the server. The URL in the browser stays
//    /board (src/i18n/routing.ts).
//
// This is the quick first check. The real checks sit next to the data:
// withApi() on every API route (401/403 as problem+json) and
// requirePageRole() on every protected page. We don't use Clerk's
// createRouteMatcher (deprecated in @clerk/nextjs 7) and we don't protect API
// paths here, because auth.protect() would answer a signed-out API call with
// 404 instead of our 401.
//
// Without Clerk keys (CI, a fresh clone), only the language step runs.
import { clerkMiddleware } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/clerk/env";
import { routing } from "@/src/i18n/routing";
import { isProtectedPage } from "@/src/server/auth/protected-pages";

const intl = createIntlMiddleware(routing);

// API routes and Clerk's own /__clerk paths are never rewritten.
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/__clerk");
}

function routeRequest(req: NextRequest) {
  return isApiPath(req.nextUrl.pathname) ? NextResponse.next() : intl(req);
}

export default isClerkConfigured()
  ? clerkMiddleware(
      async (auth, req) => {
        if (isProtectedPage(req.nextUrl.pathname)) {
          await auth.protect();
        }
        return routeRequest(req);
      },
      // Our own email-code page (app/[locale]/sign-in), in all three languages.
      { signInUrl: "/sign-in", signUpUrl: "/sign-in" },
    )
  : routeRequest;

// From Clerk's Next.js quickstart: skip Next internals and static files,
// always run for API routes and Clerk's own /__clerk paths.
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|m?js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
