import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isClerkConfigured } from "@/lib/clerk/env";
import { getSupabasePublicEnv } from "./env";

// Every Supabase call gives up after 5 s (BUILD_PROMPT section 15), so a slow
// database can't hang a request. Routes turn the failure into a 503.
export const SUPABASE_TIMEOUT_MS = 5_000;

// A fetch that aborts after timeoutMs (and still honours a caller's signal).
export function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}

// The signed-in user's Clerk session token, or null (signed out, or Clerk
// not set up). Supabase checks the token and RLS sees the user as
// auth.jwt()->>'sub'. With null, Supabase uses the publishable key alone and
// RLS treats the request as anonymous.
async function clerkToken(): Promise<string | null> {
  if (!isClerkConfigured()) return null;
  return (await auth()).getToken();
}

// Supabase client for Server Components and Route Handlers. Create a new one
// per request. Returns null when the Supabase env vars are not set, so pages
// can show "not connected" instead of crashing.
//
// It only ever uses the publishable key. The secret key never goes in here.
export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;

  return createSupabaseClient<Database>(env.url, env.key, {
    accessToken: clerkToken,
    global: { fetch: fetchWithTimeout(SUPABASE_TIMEOUT_MS) },
  });
}
