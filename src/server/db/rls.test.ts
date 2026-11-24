import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { DbError } from "@/src/server/http/db-errors";
import { NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import { claimsFor, rlsRunner, type Claims } from "./index";

vi.mock("@/src/server/http/caller", () => ({ getCaller: vi.fn() }));

const dialect = new PgDialect();

// A stand-in for Drizzle's transaction(): records the SQL each tx.execute()
// gets and counts transactions.
function fakeDrizzle() {
  const executed: { sql: string; params: unknown[] }[] = [];
  let transactions = 0;
  const tx = {
    execute: async (query: SQL) => {
      executed.push(dialect.sqlToQuery(query));
      return [];
    },
  };
  const db = {
    transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => {
      transactions++;
      return fn(tx);
    },
  };
  return { db: db as never, executed, transactions: () => transactions };
}

describe("claimsFor", () => {
  it("is anon with no other claims when signed out", () => {
    expect(claimsFor(null)).toEqual({ role: "anon" });
  });

  it("carries the Clerk user id and app role when signed in", () => {
    expect(claimsFor({ userId: "user_2abc", role: "agent" })).toEqual({
      role: "authenticated",
      sub: "user_2abc",
      metadata: { role: "agent" },
    });
  });

  it("has no app role before onboarding", () => {
    expect(claimsFor({ userId: "user_2abc", role: null }).metadata).toEqual({});
  });
});

describe("rlsRunner", () => {
  it("sets role, claims and a timeout as bound parameters before the query, in one transaction", async () => {
    const f = fakeDrizzle();
    const claims = claimsFor({ userId: "user_2abc", role: "driver" });
    const result = await rlsRunner(f.db, claims).rls(async () => "rows");

    expect(result).toBe("rows");
    expect(f.transactions()).toBe(1);
    expect(f.executed).toHaveLength(1);
    const { sql, params } = f.executed[0];
    expect(sql).toContain("set_config('role', $1, true)");
    expect(sql).toContain("set_config('request.jwt.claims', $2, true)");
    expect(sql).toContain("set_config('statement_timeout', $3, true)");
    expect(params).toEqual(["authenticated", JSON.stringify(claims), "5000"]);
    expect(sql).not.toContain("user_2abc"); // values never inside the SQL text
  });

  it("refuses any role other than anon or authenticated", () => {
    const f = fakeDrizzle();
    expect(() => rlsRunner(f.db, { role: "service_role" } as unknown as Claims)).toThrow(/Refusing/);
    expect(() => rlsRunner(f.db, { role: "postgres" } as unknown as Claims)).toThrow(/Refusing/);
  });

  it("turns a connection failure into a 503", async () => {
    const f = fakeDrizzle();
    const err = new DrizzleQueryError("select 1", [], Object.assign(new Error("timeout"), { code: "CONNECT_TIMEOUT" }));
    await expect(rlsRunner(f.db, { role: "anon" }).rls(async () => Promise.reject(err))).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("hides the SQL and parameters of a failed query but keeps the code", async () => {
    const f = fakeDrizzle();
    const err = new DrizzleQueryError(
      'insert into "users" ...',
      ["Secret Name"],
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );
    const caught = await rlsRunner(f.db, { role: "anon" })
      .rls(async () => Promise.reject(err))
      .catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).code).toBe("23505");
    expect(String((caught as Error).message)).not.toContain("Secret Name");
  });

  it("lets errors our own code throws pass through unchanged", async () => {
    const f = fakeDrizzle();
    const err = new NotFoundError();
    await expect(rlsRunner(f.db, { role: "anon" }).rls(async () => Promise.reject(err))).rejects.toBe(err);
  });
});
