import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";
import { formatReason, type ReasonTranslate } from "./reason";

const strip = (s: string) => s.replace(/[⁨⁩]/g, "");
const tFor = (messages: typeof en, locale: string): ReasonTranslate => {
  const t = createTranslator({ locale, messages, namespace: "reason" });
  return (key, values) => t(key as never, values as never);
};
const tEn = tFor(en, "en");

const base = { reason: "ENGLISH FROM THE JOB", top_hazard: "landslide" as const };

describe("formatReason", () => {
  // The same sentences jobs/risk/scoring.py reason() writes in English.
  it.each([
    [
      "landslide_rain",
      { mm: 42, hours: 72, place: "z3_nashri", zone: 3, exposure: "very_high" },
      "landslide",
      "Landslide: 42 mm rain in 72 h near Nashri; zone 3 is very exposed to landslides",
    ],
    [
      "landslide_rain_burst",
      { mm: 64, hours: 72, burst_mm: 35, burst_hours: 24, place: "z4_digdol", zone: 4, exposure: "very_high" },
      "landslide",
      "Landslide: 64 mm rain in 72 h (35 mm in 24 h) near Digdol; zone 4 is very exposed to landslides",
    ],
    [
      "rockfall_freeze_thaw",
      { mm: 8.5, hours: 48, place: "z4_ramban", zone: 4, exposure: "high" },
      "rockfall",
      "Rockfall: 8.5 mm rain in 48 h, then below 0 °C near Ramban; zone 4 is exposed to rockfall",
    ],
    [
      "flash_flood_burst",
      { mm: 31, hours: 24, place: "z2_chenani", zone: 2, exposure: "some" },
      "flash_flood",
      "Flash flood: 31 mm in 24 h near Chenani; zone 2 is somewhat exposed to flash floods",
    ],
    [
      "snow_ice",
      { snow_cm: 12, depth_m: 0.4, black_ice: "yes", place: "z5_banihal", zone: 5, exposure: "very_high" },
      "snow_ice",
      "Snow/ice: 12 cm snow in 24 h, 0.40 m on the ground, below 0 °C on a wet road near Banihal; zone 5 is very exposed to snow/ice",
    ],
  ] as const)("%s reads like the job's English", (code, params, hazard, expected) => {
    const out = formatReason({ ...base, top_hazard: hazard, reason_code: code, reason_params: { ...params } }, tEn);
    expect(out.english).toBe(false);
    expect(strip(out.text)).toBe(expected);
  });

  it("handles 'no trigger'", () => {
    const out = formatReason({ ...base, top_hazard: null, reason_code: "none", reason_params: { zone: 6 } }, tEn);
    expect(strip(out.text)).toBe("Zone 6: no rain, snow or frost trigger in the window");
  });

  it("falls back to the job's English for an unknown code or a bad param", () => {
    expect(formatReason({ ...base, reason_code: "made_up", reason_params: {} }, tEn)).toEqual({
      text: "ENGLISH FROM THE JOB",
      english: true,
    });
    const bad = { mm: "<b>", hours: 72, place: "z3_nashri", zone: 3, exposure: "very_high" };
    expect(formatReason({ ...base, reason_code: "landslide_rain", reason_params: bad }, tEn).english).toBe(true);
    const unknownPlace = { mm: 1, hours: 72, place: "nowhere", zone: 3, exposure: "low" };
    expect(formatReason({ ...base, reason_code: "landslide_rain", reason_params: unknownPlace }, tEn).english).toBe(true);
    expect(formatReason({ ...base, reason_code: null, reason_params: null }, tEn).english).toBe(true);
  });

  it("writes Urdu with the numbers isolated", () => {
    const out = formatReason(
      { ...base, reason_code: "landslide_rain", reason_params: { mm: 42, hours: 72, place: "z3_nashri", zone: 3, exposure: "high" } },
      tFor(ur as unknown as typeof en, "ur"),
    );
    expect(out.english).toBe(false);
    expect(out.text).toContain("⁨42⁩");
    expect(out.text).toContain("لینڈ سلائیڈ");
  });
});
