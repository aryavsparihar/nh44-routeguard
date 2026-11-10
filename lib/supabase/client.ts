import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabasePublicEnv } from "./env";

// Supabase client for Client Components (runs in the browser).
// Returns null when the env vars are not set.
export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  return createBrowserClient<Database>(env.url, env.key);
}
