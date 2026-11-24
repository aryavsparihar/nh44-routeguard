// Turns database failures into the right error for withApi().
import { ServiceUnavailableError } from "./errors";

// Drizzle wraps driver errors (DrizzleQueryError) and keeps the original as
// `cause`. postgres.js puts the SQLSTATE (like "23505") or a connection error
// name (like "CONNECT_TIMEOUT") in `code`.
export function pgCode(err: unknown): string | undefined {
  for (let e = err as { code?: unknown; cause?: unknown } | undefined, i = 0; e && i < 5; i++) {
    if (typeof e.code === "string") return e.code;
    e = e.cause as typeof e;
  }
  return undefined;
}

const UNAVAILABLE = new Set([
  // Network and postgres.js connection errors
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED",
  // Postgres: shutting down, starting up, too many connections, our 5 s timeout, bad login
  "57P01", "57P02", "57P03", "53300", "57014", "28P01", "28000",
]);

// The database is down, slow or unreachable → 503, so the client knows to
// retry. Anything else (a constraint, a bad query, RLS) returns null: it's a
// bug or a case the repository handles, and withApi() turns it into a 500.
// Only the code goes in the message; Postgres details can quote row values.
export function unavailableDbError(err: unknown): ServiceUnavailableError | null {
  const code = pgCode(err);
  if (!code || !(UNAVAILABLE.has(code) || code.startsWith("08"))) return null;
  return new ServiceUnavailableError("The database is not reachable right now. Try again soon.");
}

// A failed query, carrying only the SQLSTATE. Drizzle's own error message
// includes the SQL and its parameters (which can be names or notes), so it
// never reaches the logs; repositories check `code` (e.g. "23505").
export class DbError extends Error {
  constructor(readonly code: string | undefined) {
    super(`Database error ${code ?? "(no code)"}`);
    this.name = "DbError";
  }
}
