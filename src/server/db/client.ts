import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// The one Postgres connection pool for this server process. Only
// src/server/db/index.ts imports this: routes and repositories get a
// connection through getDb().rls(), which switches to the caller's role and
// claims first, so Row Level Security applies to every query.
//
// DATABASE_URL is the Supabase transaction pooler (port 6543) with the
// routeguard_app login. That login can't read anything until it switches to
// anon or authenticated (migration 20261125120000_app_db_role.sql).

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { routeguardDb?: DrizzleDb };

export function databaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || null;
}

// Created on first use, so `next build` works without DATABASE_URL. Kept on
// globalThis so dev-server reloads reuse the pool instead of opening new ones.
export function drizzleDb(url: string): DrizzleDb {
  globalForDb.routeguardDb ??= drizzle({
    client: postgres(url, {
      prepare: false, // the transaction pooler doesn't support prepared statements
      max: 5, // per replica; 3 replicas stay well under the pooler's limit
      connect_timeout: 5,
      idle_timeout: 20,
      ssl: "require",
    }),
    schema,
  });
  return globalForDb.routeguardDb;
}
