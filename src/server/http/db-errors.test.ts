import { describe, expect, it } from "vitest";
import { dbError } from "./db-errors";
import { ServiceUnavailableError } from "./errors";
import { toProblemResponse } from "./problem";

const REQUEST_ID = "3f1c3c1e-2b9a-4b7e-9a51-6f0d2f6b7a10";

describe("dbError", () => {
  it.each([
    ["a timeout (no answer)", { message: "TimeoutError: The operation was aborted due to timeout", code: "" }, 0],
    ["a network failure", { message: "TypeError: fetch failed", code: "" }, 0],
    ["a gateway error", { message: "<html>Bad Gateway</html>" }, 502],
    ["database unavailable", { message: "Service Unavailable" }, 503],
    ["a gateway timeout", { message: "Gateway Timeout" }, 504],
  ])("503 for %s", (_label, error, status) => {
    expect(dbError(error, status)).toBeInstanceOf(ServiceUnavailableError);
  });

  it("a constraint error becomes a plain error (generic 500), without row details", async () => {
    const error = dbError({ message: "duplicate key value violates unique constraint", code: "23505" }, 409);
    expect(error).not.toBeInstanceOf(ServiceUnavailableError);
    expect(error.message).toContain("23505");

    const res = toProblemResponse(error, REQUEST_ID, "/api/v1/x");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("duplicate key");
  });

  it("an RLS refusal is also a 500: the route should have checked access first", () => {
    const error = dbError({ message: "new row violates row-level security policy", code: "42501" }, 403);
    expect(error).not.toBeInstanceOf(ServiceUnavailableError);
  });
});
