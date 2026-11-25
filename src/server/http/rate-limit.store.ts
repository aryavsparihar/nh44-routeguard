import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/src/server/db";

// The shared counter behind rate-limit.ts, in its own module so tests can
// replace it.
export type Hit = { allowed: boolean; hits: number; retryAfterSeconds: number };

// Calls private.rate_limit_hit() (migration 20261125140000_rate_limits.sql)
// as the caller's database role.
export async function hitBucket(bucket: string, limit: number, windowSeconds: number): Promise<Hit> {
  const db = await getDb();
  const rows = await db.rls((tx) =>
    tx.execute<{ allowed: boolean; hits: number; retry_after_seconds: number }>(
      sql`select * from private.rate_limit_hit(${bucket}::text, ${limit}::integer, ${windowSeconds}::integer)`,
    ),
  );
  const row = rows[0];
  return { allowed: row.allowed, hits: Number(row.hits), retryAfterSeconds: Number(row.retry_after_seconds) };
}
