import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({ useSignIn: () => ({}), useSignUp: () => ({}) }));
const { safeRedirect } = await import("./EmailCodeSignIn");

const ORIGIN = "https://routeguard.example";

describe("safeRedirect after sign-in", () => {
  it("goes back to a page on this site, with its query", () => {
    expect(safeRedirect(`${ORIGIN}/board?status=moving`, ORIGIN)).toBe("/board?status=moving");
    expect(safeRedirect("/report/new", ORIGIN)).toBe("/report/new");
  });

  it("never leaves the site (open redirect)", () => {
    expect(safeRedirect("https://evil.example/phish", ORIGIN)).toBe("/me");
    expect(safeRedirect("//evil.example/phish", ORIGIN)).toBe("/me");
    expect(safeRedirect("javascript:alert(1)", ORIGIN)).toBe("/me");
  });

  it("falls back to the account page", () => {
    expect(safeRedirect(null, ORIGIN)).toBe("/me");
    expect(safeRedirect(`${ORIGIN}/sign-in?x=1`, ORIGIN)).toBe("/me");
  });
});
