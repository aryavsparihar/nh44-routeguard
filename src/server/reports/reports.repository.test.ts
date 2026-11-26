import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import type { Db } from "@/src/server/db";
import { listReportsForAdmin } from "./reports.repository";

// The SQL listReportsForAdmin sends, built without a database: rls() keeps
// the query builder instead of running it.
async function adminListSql(opts: Parameters<typeof listReportsForAdmin>[1]) {
  let query: { toSQL(): { sql: string } } | null = null;
  const db = {
    rls: async (fn: (tx: unknown) => unknown) => {
      query = fn(drizzle.mock()) as { toSQL(): { sql: string } };
      return [];
    },
  } as unknown as Db;
  await listReportsForAdmin(db, opts);
  return query!.toSQL().sql;
}

describe("listReportsForAdmin", () => {
  it("counts each report's flags by that report's id, not the flag's own id", async () => {
    // A bare "id" inside the subquery means report_flags.id (a bigint), and
    // Postgres refused it with 42883 on 26 Nov 2026.
    const text = await adminListSql({ limit: 50 });
    expect(text).toContain('where f.report_id = "reports"."id"');
    expect(text).toContain('from "reports"');
  });
});
