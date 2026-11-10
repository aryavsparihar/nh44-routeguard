import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

// Supabase client for Client Components (runs in the browser).
// Returns null when the env vars are not set.
export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.key);
}
