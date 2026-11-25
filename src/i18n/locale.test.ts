import { describe, expect, it } from "vitest";
import { dirFor, intlLocale } from "./locale";

describe("locale helpers", () => {
  it("writes Urdu right to left, Hindi and English left to right", () => {
    expect(dirFor("ur")).toBe("rtl");
    expect(dirFor("hi")).toBe("ltr");
    expect(dirFor("en")).toBe("ltr");
  });
  it("asks Intl for Latin digits", () => {
    expect(intlLocale("ur")).toBe("ur-IN-u-nu-latn");
  });
});
