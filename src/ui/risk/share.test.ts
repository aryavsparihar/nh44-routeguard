import { describe, expect, it, vi } from "vitest";
import { LOCALES } from "@/src/i18n/routing";
import { riskSummary } from "@/src/server/risk/summary";
import { HORIZONS, ZONE_IDS, type RiskRow } from "@/src/shared/risk";
import { SHARE_MAX_BYTES, byteLength, shareSummary, shareText } from "./share";

// The longest summary the API can send: every zone high at every time, with
// the hazard that has the longest name in each language.
function worstRun() {
  const rows: RiskRow[] = [];
  for (const h of HORIZONS) {
    for (const z of ZONE_IDS) {
      rows.push({
        zone_id: z,
        horizon_hours: h,
        overall: 0.99,
        risk_low: 0.99,
        risk_high: 0.99,
        level: "high",
        top_hazard: "flash_flood",
        confidence: "low",
        hazards: { landslide: 0.99, rockfall: 0.99, flash_flood: 0.99, snow_ice: 0.99 },
        reason: "",
        reason_code: "none",
        reason_params: { zone: z },
      });
    }
  }
  return { runAt: new Date("2026-11-26T06:37:00Z"), rows } as Parameters<typeof riskSummary>[0];
}
const link = "https://routeguard.example.azurecontainerapps.io/strip";

describe("shareText", () => {
  it.each(LOCALES)("stays under 5 KB in %s, even with every zone high", (locale) => {
    const text = shareText(riskSummary(worstRun(), locale), link);
    expect(byteLength(text)).toBeLessThan(SHARE_MAX_BYTES);
  });

  it("keeps the data time, the disclaimer and the link", () => {
    const text = shareText(riskSummary(worstRun(), "en"), link).replace(/[⁨⁩]/g, "");
    expect(text).toContain("Scores from");
    expect(text).toContain("not an official");
    expect(text.trimEnd().endsWith(link)).toBe(true);
  });
});

describe("shareSummary", () => {
  it("uses the phone's share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareSummary({ share, clipboard: { writeText } }, "T", "body")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "T", text: "body" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies to the clipboard when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareSummary({ clipboard: { writeText } }, "T", "body")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("body");
  });

  it("copies when sharing isn't allowed, but not when the person cancelled", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const denied = Object.assign(new Error("no"), { name: "NotAllowedError" });
    expect(await shareSummary({ share: vi.fn().mockRejectedValue(denied), clipboard: { writeText } }, "T", "b")).toBe("copied");
    writeText.mockClear();
    const aborted = Object.assign(new Error("closed"), { name: "AbortError" });
    expect(await shareSummary({ share: vi.fn().mockRejectedValue(aborted), clipboard: { writeText } }, "T", "b")).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("says it failed when neither works", async () => {
    expect(await shareSummary({}, "T", "b")).toBe("failed");
    expect(await shareSummary({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("x")) } }, "T", "b")).toBe("failed");
  });
});
