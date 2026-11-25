import { clerkSetup } from "@clerk/testing/playwright";

// Signed-in tests (E2E_DB=1) get a Clerk testing token, which lets an
// automated browser past Clerk's bot protection on our development instance.
// Keys come from .env.local (loaded in playwright.config.ts) and are never
// printed. Without E2E_DB there is nothing to set up: CI has no keys.
export default async function globalSetup() {
  if (!process.env.E2E_DB) return;
  process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  await clerkSetup();
}
