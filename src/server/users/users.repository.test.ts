import { describe, expect, it } from "vitest";
import type { Db } from "@/src/server/db";
import { ForbiddenError, ServiceUnavailableError, ValidationError } from "@/src/server/http/errors";
import { adminSetRole, insertOwnUser } from "./users.repository";

type Answer = { data?: unknown; error: { code?: string; message: string } | null; status: number };

// Just enough of a Supabase client for these two functions.
function fakeDb(answer: Answer): Db {
  return {
    from: () => ({ insert: async () => answer }),
    rpc: async () => answer,
  } as unknown as Db;
}

const args = { targetId: "user_t1", role: "police" as const, reason: "Demo", requestId: "req-1" };

describe("insertOwnUser", () => {
  it("returns 'created' when the insert works", async () => {
    expect(await insertOwnUser(fakeDb({ error: null, status: 201 }), { id: "user_t1", role: "driver" })).toBe(
      "created",
    );
  });

  it("returns 'exists' on a duplicate key", async () => {
    const db = fakeDb({ error: { code: "23505", message: "duplicate key" }, status: 409 });
    expect(await insertOwnUser(db, { id: "user_t1", role: "driver" })).toBe("exists");
  });

  it("throws a 503 when the database doesn't answer", async () => {
    const db = fakeDb({ error: { message: "fetch failed" }, status: 0 });
    await expect(insertOwnUser(db, { id: "user_t1", role: "driver" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });
});

describe("adminSetRole", () => {
  it("returns the old role", async () => {
    expect(await adminSetRole(fakeDb({ data: "grower", error: null, status: 200 }), args)).toBe("grower");
  });

  it("returns null when the user had no row", async () => {
    expect(await adminSetRole(fakeDb({ data: null, error: null, status: 200 }), args)).toBeNull();
  });

  it("turns the database's 'not an admin' into a 403", async () => {
    const db = fakeDb({ error: { code: "42501", message: "only admins" }, status: 403 });
    await expect(adminSetRole(db, args)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("turns the database's 'reason required' into a 422", async () => {
    const db = fakeDb({ error: { code: "22023", message: "reason" }, status: 400 });
    await expect(adminSetRole(db, args)).rejects.toBeInstanceOf(ValidationError);
  });
});
