import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ServiceUnavailableError } from "@/src/server/http/errors";

// The Supabase client a route uses: publishable key + the caller's Clerk
// token, so RLS applies to every query (lib/supabase/server.ts).
export type Db = NonNullable<Awaited<ReturnType<typeof createClient>>>;

// Like createClient(), but a missing Supabase setup is a 503 instead of null,
// so routes don't each repeat the check.
export async function getDb(): Promise<Db> {
  const db = await createClient();
  if (!db) throw new ServiceUnavailableError("The database is not set up on this server.");
  return db;
}
