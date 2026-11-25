import { describe, expect, it } from "vitest";
import { formatTime, isolate } from "./format";

describe("formatTime", () => {
  const at = new Date("2026-11-25T10:37:00Z"); // 16:07 in India

  it("shows India time with Latin digits in every language", () => {
    expect(formatTime(at, "en")).toBe("16:07");
    expect(formatTime(at, "hi")).toBe("16:07");
    expect(formatTime(at, "ur")).toBe("16:07");
  });
});

describe("isolate", () => {
  it("wraps a value in first-strong-isolate marks so Urdu text can't reorder it", () => {
    expect(isolate("+48 h")).toBe("⁨+48 h⁩");
  });
});
