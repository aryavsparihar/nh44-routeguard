import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import type { Db } from "@/src/server/db";
import { DbError } from "@/src/server/http/db-errors";
import { ForbiddenError, ServiceUnavailableError, ValidationError } from "@/src/server/http/errors";
import { adminSetRole, insertOwnUser, ownUserInsert } from "./users.repository";

// A Db whose rls() answers with fixed rows or fails with a fixed error.
function fakeDb(answer: { rows?: unknown[]; error?: Error }): Db {
  return {
    rls: async () => {
      if (answer.error) throw answer.error;
      return answer.rows ?? [];
    },
  } as unknown as Db;
}

const args = { targetId: "user_t1", role: "police" as const, reason: "Demo", requestId: "req-1" };

describe("insertOwnUser", () => {
  it("returns 'created' when the insert works", async () => {
    expect(await insertOwnUser(fakeDb({}), { id: "user_t1", role: "driver" })).toBe("created");
  });

  it("returns 'exists' on a duplicate key", async () => {
    const db = fakeDb({ error: new DbError("23505") });
    expect(await insertOwnUser(db, { id: "user_t1", role: "driver" })).toBe("exists");
  });

  it("passes a 503 through when the database doesn't answer", async () => {
    const db = fakeDb({ error: new ServiceUnavailableError("down") });
    await expect(insertOwnUser(db, { id: "user_t1", role: "driver" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("names only the columns a signed-in user may insert (column grants)", () => {
    const query = drizzle
      .mock()
      .insert(ownUserInsert)
      .values({ id: "user_t1", role: "driver", display_name: undefined, language: sql`default` })
      .toSQL();
    expect(query.sql).toBe(
      'insert into "users" ("id", "role", "display_name", "language") values ($1, $2, default, default)',
    );
    expect(query.params).toEqual(["user_t1", "driver"]);
  });
});

describe("adminSetRole", () => {
  it("returns the old role", async () => {
    expect(await adminSetRole(fakeDb({ rows: [{ old_role: "grower" }] }), args)).toBe("grower");
  });

  it("returns null when the user had no row", async () => {
    expect(await adminSetRole(fakeDb({ rows: [{ old_role: null }] }), args)).toBeNull();
  });

  it("turns the database's 'not an admin' into a 403", async () => {
    await expect(adminSetRole(fakeDb({ error: new DbError("42501") }), args)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("turns the database's 'reason required' into a 422", async () => {
    await expect(adminSetRole(fakeDb({ error: new DbError("22023") }), args)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
