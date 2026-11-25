import { describe, expect, it } from "vitest";
import { isActive } from "./nav";

describe("isActive", () => {
  it("marks the start page only on /", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/board", "/")).toBe(false);
  });
  it("marks a section on its sub-pages, not on look-alike paths", () => {
    expect(isActive("/board", "/board")).toBe(true);
    expect(isActive("/board/42", "/board")).toBe(true);
    expect(isActive("/boardroom", "/board")).toBe(false);
  });
});
