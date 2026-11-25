import "server-only";
import { DrizzleQueryError, sql } from "drizzle-orm";
import { getCaller, type Caller } from "@/src/server/http/caller";
import { ServiceUnavailableError } from "@/src/server/http/errors";
import { DbError, pgCode, unavailableDbError } from "@/src/server/http/db-errors";
import { databaseUrl, drizzleDb, type DrizzleDb } from "./client";

// How every server query reaches the database (Drizzle ORM over the Supabase
// pooler). Each call to rls() is one transaction that first does what
// Supabase's own API (PostgREST) does for a request:
//
//   set the role to anon (signed out) or authenticated (signed in),
//   set request.jwt.claims to the caller's claims,
//   set a 5 s statement timeout,
//
// so the Row Level Security policies see the same auth.jwt() as before and
// decide what the query may read or write (docs/security.md). Values go in
// as bound parameters, never as SQL text.
//
//   const db = await getDb();
//   const rows = await db.rls((tx) => tx.select().from(zones));

export type Tx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];
export type Db = { rls<T>(fn: (tx: Tx) => Promise<T>): Promise<T> };

// routeguard_worker is only for the queue worker (getWorkerDb below); a
// caller's claims are never that role.
export const DB_ROLES = ["anon", "authenticated", "routeguard_worker"] as const;
export type DbRole = (typeof DB_ROLES)[number];
export type Claims = { role: DbRole; sub?: string; metadata?: { role?: string } };
export const WORKER_CLAIMS: Claims = { role: "routeguard_worker" };

// The claims RLS reads (private.jwt_sub(), private.jwt_role()), built from the
// caller Clerk has already verified. Nothing else from the token is passed on.
export function claimsFor(caller: Caller | null): Claims {
  if (!caller) return { role: "anon" };
  return { role: "authenticated", sub: caller.userId, metadata: caller.role ? { role: caller.role } : {} };
}

export const STATEMENT_TIMEOUT_MS = 5_000;

export function rlsRunner(db: Pick<DrizzleDb, "transaction">, claims: Claims): Db {
  if (!DB_ROLES.includes(claims.role)) throw new Error(`Refusing database role ${String(claims.role)}`);
  return {
    async rls(fn) {
      try {
        return await db.transaction(async (tx) => {
          await tx.execute(sql`select
            set_config('role', ${claims.role}, true),
            set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
            set_config('statement_timeout', ${String(STATEMENT_TIMEOUT_MS)}, true)`);
          return fn(tx);
        });
      } catch (err) {
        const unavailable = unavailableDbError(err);
        if (unavailable) throw unavailable;
        // Query errors lose their SQL text and parameters here; errors our own
        // code throws on purpose (ApiError and friends) pass through as they are.
        if (err instanceof DrizzleQueryError || pgCode(err)) throw new DbError(pgCode(err));
        throw err;
      }
    },
  };
}

// The database for this request, acting as the current caller.
export async function getDb(): Promise<Db> {
  const url = databaseUrl();
  if (!url) throw new ServiceUnavailableError("The database is not set up on this server.");
  return rlsRunner(drizzleDb(url), claimsFor(await getCaller()));
}

// The database for the queue worker (POST /api/v1/internal/jobs/run, after
// the JOBS_SECRET check). The routeguard_worker role can only run the private
// job functions (read, finish, fail) and nothing else.
export function getWorkerDb(): Db {
  const url = databaseUrl();
  if (!url) throw new ServiceUnavailableError("The database is not set up on this server.");
  return rlsRunner(drizzleDb(url), WORKER_CLAIMS);
}
