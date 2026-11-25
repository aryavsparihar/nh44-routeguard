import { describe, expect, it } from "vitest";
import { httpsUrl } from "@/src/server/schemas/https-url";
import { windowErrors } from "./official-updates.schemas";

describe("httpsUrl", () => {
  it.each([
    "https://jktrafficpolice.example/advisory",
    "  https://x.example/a?b=c  ",
  ])("accepts %s", (url) => expect(httpsUrl.safeParse(url).success).toBe(true));

  it.each([
    "http://x.example/a",
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://user:pw@x.example/",
    "https://localhost/",
    "x.example/a",
    `https://x.example/${"a".repeat(500)}`,
  ])("refuses %s", (url) => expect(httpsUrl.safeParse(url).success).toBe(false));
});

describe("windowErrors", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  const at = (iso: string) => new Date(iso);

  it("is fine for a window that starts now and ends later", () => {
    expect(windowErrors(at("2026-11-25T12:00:00Z"), at("2026-11-25T18:00:00Z"), now)).toEqual([]);
  });

  it("allows a few minutes of clock drift", () => {
    expect(windowErrors(at("2026-11-25T12:05:00Z"), at("2026-11-25T18:00:00Z"), now)).toEqual([]);
  });

  it("refuses an issue time in the future and an end before the start", () => {
    expect(windowErrors(at("2026-11-25T13:00:00Z"), at("2026-11-25T13:00:00Z"), now).map((e) => e.path)).toEqual([
      "issued_at",
      "valid_until",
    ]);
  });
});
