// Turns a failed Supabase call into the right error for withApi().
//
// Use it in repositories:
//   const { data, error, status } = await supabase.from("zones").select("id, name");
//   if (error) throw dbError(error, status);
import { ServiceUnavailableError } from "./errors";

type SupabaseError = { message: string; code?: string };

// No answer at all (status 0: network down, DNS, our 5 s timeout) or a
// gateway saying the database is down (502, 503, 504) → 503, so the client
// knows to retry. Anything else (a constraint, a bad query, RLS) is a bug or
// a case the repository should have handled → a plain Error, which withApi()
// logs and answers with a generic 500.
export function dbError(error: SupabaseError, status: number): Error {
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return new ServiceUnavailableError("The database is not reachable right now. Try again soon.");
  }
  // Only the code and message go into the server log. Postgres `details`
  // can quote row values, so we leave them out.
  return new Error(`Supabase error ${error.code || "(no code)"} (HTTP ${status}): ${error.message}`);
}
