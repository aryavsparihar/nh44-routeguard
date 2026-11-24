import { describe, expect, it } from "vitest";
import { isProtectedPage } from "./protected-pages";

describe("isProtectedPage", () => {
  it.each(["/board", "/report/new", "/admin", "/admin/", "/admin/users", "/admin/audit-log"])(
    "protects %s",
    (path) => expect(isProtectedPage(path)).toBe(true),
  );

  it.each(["/", "/status", "/administrator", "/boardroom", "/report", "/api/v1/me", "/api/v1/admin/users/x/role"])(
    "leaves %s to the page or withApi()",
    (path) => expect(isProtectedPage(path)).toBe(false),
  );
});
