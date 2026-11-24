import { describe, expect, it } from "vitest";
import { AuthError, ForbiddenError } from "./errors";
import { checkOrigin, requireAccess } from "./guards";

describe("requireAccess", () => {
  const driver = { userId: "user_1", role: "driver" as const };
  const noRole = { userId: "user_2", role: null };

  it("lets anyone through on public routes", () => {
    expect(() => requireAccess(null, "public")).not.toThrow();
  });

  it("401 when signed out on a protected route", () => {
    expect(() => requireAccess(null, "signed-in")).toThrow(AuthError);
    expect(() => requireAccess(null, ["admin"])).toThrow(AuthError);
  });

  it("lets any signed-in user through on signed-in routes", () => {
    expect(() => requireAccess(noRole, "signed-in")).not.toThrow();
  });

  it("403 for the wrong role, or no role yet", () => {
    expect(() => requireAccess(driver, ["admin", "police"])).toThrow(ForbiddenError);
    expect(() => requireAccess(noRole, ["driver"])).toThrow(ForbiddenError);
  });

  it("passes for a listed role", () => {
    expect(() => requireAccess(driver, ["driver", "agent"])).not.toThrow();
  });
});

describe("checkOrigin", () => {
  function req(method: string, headers: Record<string, string>) {
    return new Request("http://localhost:3000/api/v1/x", { method, headers });
  }

  it("skips GET", () => {
    expect(() => checkOrigin(req("GET", { host: "localhost:3000" }))).not.toThrow();
  });

  it("passes POST from our own origin", () => {
    const r = req("POST", { host: "localhost:3000", origin: "http://localhost:3000" });
    expect(() => checkOrigin(r)).not.toThrow();
  });

  it.each([
    ["another site", { host: "localhost:3000", origin: "https://evil.example" }],
    ["a look-alike port", { host: "localhost:3000", origin: "http://localhost:3001" }],
    ["no Origin", { host: "localhost:3000" }],
    ["Origin null", { host: "localhost:3000", origin: "null" }],
  ])("403 for %s", (_label, headers) => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(() => checkOrigin(req(method, headers))).toThrow(ForbiddenError);
    }
  });
});
