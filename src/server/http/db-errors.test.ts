import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DbError, pgCode, unavailableDbError } from "./db-errors";
import { ServiceUnavailableError } from "./errors";
import { toProblemResponse } from "./problem";

const REQUEST_ID = "3f1c3c1e-2b9a-4b7e-9a51-6f0d2f6b7a10";
const pgError = (code: string, message = "boom") => Object.assign(new Error(message), { code });

describe("pgCode", () => {
  it("reads the code from the error or from Drizzle's wrapped cause", () => {
    expect(pgCode(pgError("23505"))).toBe("23505");
    expect(pgCode(new DrizzleQueryError("insert ...", ["x"], pgError("42501")))).toBe("42501");
    expect(pgCode(new Error("no code"))).toBeUndefined();
    expect(pgCode(null)).toBeUndefined();
  });
});

describe("unavailableDbError", () => {
  it.each([
    ["the server refusing connections", "ECONNREFUSED"],
    ["a connect timeout", "CONNECT_TIMEOUT"],
    ["a dropped connection", "CONNECTION_CLOSED"],
    ["our 5 s statement timeout", "57014"],
    ["too many connections", "53300"],
    ["the database shutting down", "57P01"],
    ["a connection-class SQLSTATE", "08006"],
    ["a wrong DATABASE_URL password", "28P01"],
  ])("503 for %s", (_label, code) => {
    expect(unavailableDbError(new DrizzleQueryError("select 1", [], pgError(code)))).toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it.each([["a unique violation", "23505"], ["an RLS refusal", "42501"], ["a check constraint", "23514"]])(
    "null for %s (the repository or withApi handles it)",
    (_label, code) => expect(unavailableDbError(pgError(code))).toBeNull(),
  );
});

describe("DbError", () => {
  it("keeps the code but not the SQL or its parameters, and is a generic 500", async () => {
    const error = new DbError("23505");
    expect(error.code).toBe("23505");
    expect(error.message).toBe("Database error 23505");

    const res = toProblemResponse(error, REQUEST_ID, "/api/v1/x");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("23505");
  });
});
