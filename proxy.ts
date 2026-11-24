// Runs before every matched request (Next.js 16 calls middleware "proxy").
//
// With Clerk keys set, clerkMiddleware() reads the session cookie or the
// "Authorization: Bearer <token>" header so that auth() works in route
// handlers. It protects no routes by itself: each API route checks access
// in withApi(), and page protection comes in A4.
//
// Without keys (CI, a fresh clone), requests pass straight through.
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/clerk/env";

const passThrough = () => NextResponse.next();

export default isClerkConfigured() ? clerkMiddleware() : passThrough;

// From Clerk's Next.js quickstart: skip Next internals and static files,
// always run for API routes and Clerk's own /__clerk paths.
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
