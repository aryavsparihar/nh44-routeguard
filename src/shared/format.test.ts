import { describe, expect, it } from "vitest";
import { formatDate, formatTime, isolate, sourceHost } from "./format";

describe("formatTime", () => {
  const at = new Date("2026-11-25T10:37:00Z"); // 16:07 in India

  it("shows India time with Latin digits in every language", () => {
    expect(formatTime(at, "en")).toBe("16:07");
    expect(formatTime(at, "hi")).toBe("16:07");
    expect(formatTime(at, "ur")).toBe("16:07");
  });
});

describe("formatDate", () => {
  it("shows the India date: 23 Jan 2026 even at 20:00 UTC on the 22nd", () => {
    const at = new Date("2026-01-22T20:00:00Z"); // 01:30 on the 23rd in India
    expect(formatDate(at, "en")).toBe("23 Jan 2026");
    expect(formatDate(at, "hi")).toContain("2026");
    expect(formatDate(at, "hi")).toContain("23");
  });
});

describe("isolate", () => {
  it("wraps a value in first-strong-isolate marks so Urdu text can't reorder it", () => {
    expect(isolate("+48 h")).toBe("⁨+48 h⁩");
  });
});

describe("sourceHost", () => {
  it.each([
    ["https://www.tribuneindia.com/news/j-k/x", "tribuneindia.com"],
    ["https://jktrafficpolice.gov.in/advisory", "jktrafficpolice.gov.in"],
    ["http://example.com/", null],
    ["javascript:alert(1)", null],
    ["https://user:pw@example.com/", null],
    ["not a url", null],
    [null, null],
  ])("%s → %s", (url, host) => {
    expect(sourceHost(url)).toBe(host);
  });
});
