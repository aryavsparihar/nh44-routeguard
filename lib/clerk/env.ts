import "server-only";

// Is Clerk set up on this machine or server?
//
// CI builds with no keys, and so does a teammate who hasn't added them yet.
// Then we skip Clerk completely (everyone counts as signed out) instead of
// crashing, the same way lib/supabase/env.ts handles missing Supabase keys.
//
// Only checks that the keys exist. Never log or return their values.
export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}
