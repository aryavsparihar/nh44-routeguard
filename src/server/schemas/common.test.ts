import { describe, expect, it } from "vitest";
import { cleanText, corridorLat, corridorLng, pageQuery, truckNumber } from "./common";

describe("cleanText", () => {
  const name = cleanText(10);
  const note = cleanText(200, { multiline: true });

  it("trims and normalises to NFC", () => {
    // "é" written as e + combining accent becomes the single character é.
    expect(name.parse("  café ")).toBe("café");
  });

  it("rejects empty, too long and control characters", () => {
    expect(name.safeParse("   ").success).toBe(false);
    expect(name.safeParse("x".repeat(11)).success).toBe(false);
    expect(name.safeParse("ab\u0000c").success).toBe(false);
    expect(name.safeParse("two\nlines").success).toBe(false);
  });

  it("allows newlines only in multi-line text", () => {
    expect(note.parse("line one\nline two")).toBe("line one\nline two");
    expect(note.safeParse("bell\u0007").success).toBe(false);
  });

  it("keeps PostgREST filter syntax and HTML as plain text", () => {
    // These must be stored as typed. Safety comes from typed .eq() filters
    // and from rendering as text, not from rewriting the input.
    expect(note.parse("x),id.gt.0")).toBe("x),id.gt.0");
    expect(note.parse("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });

  it("keeps Hindi and Urdu text", () => {
    expect(note.parse("सड़क बंद है")).toBe("सड़क बंद है");
    expect(note.parse("سڑک بند ہے")).toBe("سڑک بند ہے");
  });
});

describe("truckNumber", () => {
  it.each([
    ["JK05G7712", "JK05G7712"],
    ["jk 05 g 7712", "JK05G7712"],
    ["PB-10-AB-1234", "PB10AB1234"],
    ["DL1C1234", "DL1C1234"],
    ["22 BH 1234 AA", "22BH1234AA"],
  ])("accepts %j as %j", (input, expected) => {
    expect(truckNumber.parse(input)).toBe(expected);
  });

  it.each(["", "JK05", "1234JK05", "JK05G771", "22BH123AA", "JK05G7712X", "JK05G7712; drop table"])(
    "rejects %j",
    (input) => {
      expect(truckNumber.safeParse(input).success).toBe(false);
    },
  );
});

describe("corridor box", () => {
  it("accepts a point on NH-44 (Banihal area)", () => {
    expect(corridorLat.safeParse(33.43).success).toBe(true);
    expect(corridorLng.safeParse(75.19).success).toBe(true);
  });

  it("rejects points outside with a clear message", () => {
    const result = corridorLat.safeParse(28.6); // Delhi
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("outside the NH-44 corridor");
    expect(corridorLng.safeParse(77.2).success).toBe(false);
  });
});

describe("pageQuery", () => {
  it("defaults limit to 20 and reads numbers from text", () => {
    expect(pageQuery.parse({})).toEqual({ limit: 20 });
    expect(pageQuery.parse({ limit: "50", cursor: "abc" })).toEqual({ limit: 50, cursor: "abc" });
  });

  it("caps limit at 100 and rejects unknown params", () => {
    expect(pageQuery.safeParse({ limit: "101" }).success).toBe(false);
    expect(pageQuery.safeParse({ limit: "0" }).success).toBe(false);
    expect(pageQuery.safeParse({ sort: "id" }).success).toBe(false);
  });
});
