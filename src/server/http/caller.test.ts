import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stand-in for Clerk's auth(). Each test sets what it returns.
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));

const { getCaller, roleFromClaims } = await import("./caller");

function setClerkKeys(on: boolean) {
  if (on) {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_not_a_real_key");
    vi.stubEnv("CLERK_SECRET_KEY", "not-a-real-key-for-tests");
  } else {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
  }
}

beforeEach(() => {
  authMock.mockReset();
  setClerkKeys(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCaller", () => {
  it("is signed out when Clerk has no keys, without calling Clerk", async () => {
    setClerkKeys(false);
    expect(await getCaller()).toBeNull();
    expect(authMock).not.toHaveBeenCalled();
  });

  it("is signed out when Clerk has no user", async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: null });
    expect(await getCaller()).toBeNull();
  });

  it("returns the user and their role", async () => {
    authMock.mockResolvedValue({ userId: "user_2abc", sessionClaims: { metadata: { role: "agent" } } });
    expect(await getCaller()).toEqual({ userId: "user_2abc", role: "agent" });
  });

  it("gives role null when the user hasn't picked one", async () => {
    authMock.mockResolvedValue({ userId: "user_2abc", sessionClaims: { metadata: {} } });
    expect(await getCaller()).toEqual({ userId: "user_2abc", role: null });
  });
});

describe("roleFromClaims", () => {
  it.each(["grower", "trader", "agent", "driver", "admin"])("accepts %s", (role) => {
    expect(roleFromClaims({ metadata: { role } })).toBe(role);
  });

  it("treats police as no role (merged into TCU, 26 Nov 2026)", () => {
    expect(roleFromClaims({ metadata: { role: "police" } })).toBeNull();
  });

  it.each([
    ["an unknown role", { metadata: { role: "superadmin" } }],
    ["different case", { metadata: { role: "Admin" } }],
    ["a number", { metadata: { role: 1 } }],
    ["a list", { metadata: { role: ["admin"] } }],
    ["role at the top level", { role: "admin" }],
    ["no metadata", {}],
    ["null claims", null],
  ])("gives null for %s", (_label, claims) => {
    expect(roleFromClaims(claims)).toBeNull();
  });
});
