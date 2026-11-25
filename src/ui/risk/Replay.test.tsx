import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";
import type { ReplaySummary } from "@/src/shared/api-types";
import { ReplayBanner, ReplayPicker } from "./Replay";

// A real replay (lib/risk/replays.json).
const NAVYUG: ReplaySummary = {
  id: "inc-2026-01-23-z5-snow_ice",
  date: "2026-01-23",
  scored_at: "2026-01-23T06:00:00Z",
  zone_id: 5,
  place: "Navyug Tunnel, Banihal",
  hazard: "snow_ice",
  source_publisher: "ETV Bharat (PTI)",
  source_url: "https://www.etvbharat.com/en/bharat/x",
};

function render(node: React.ReactNode, locale: "en" | "ur" = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ur} timeZone="Asia/Kolkata">
      {node}
    </NextIntlClientProvider>,
  );
}

describe("ReplayBanner", () => {
  it("says plainly that it is a past storm, which day, where, and the source", () => {
    const html = render(<ReplayBanner replay={NAVYUG} onBack={() => {}} />);
    expect(html).toContain("Past storm, not today");
    expect(html).toContain("23 Jan 2026");
    expect(html).toContain("Navyug Tunnel, Banihal");
    expect(html).toContain("(Snow/ice)");
    expect(html).toContain("not a forecast");
    expect(html).toContain('href="https://www.etvbharat.com/en/bharat/x"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Back to today");
  });

  it("links only to an https source", () => {
    const html = render(<ReplayBanner replay={{ ...NAVYUG, source_url: "javascript:alert(1)" }} onBack={() => {}} />);
    expect(html).not.toContain("href=");
    expect(html).toContain("Source: ETV Bharat (PTI)");
  });

  it("is in Urdu with the date and place kept whole", () => {
    const html = render(<ReplayBanner replay={NAVYUG} onBack={() => {}} />, "ur");
    expect(html).toContain("پچھلا طوفان، آج کا نہیں");
    expect(html).toContain("⁨Navyug Tunnel, Banihal⁩");
  });
});

describe("ReplayPicker", () => {
  it("offers today first, then each storm", () => {
    const html = render(<ReplayPicker replays={[NAVYUG]} value={null} onChange={() => {}} />);
    expect(html.indexOf("Today (live)")).toBeLessThan(html.indexOf("Past storm: "));
    expect(html).toContain(`value="${NAVYUG.id}"`);
  });

  it("shows nothing when there are no storms", () => {
    expect(render(<ReplayPicker replays={[]} value={null} onChange={() => {}} />)).toBe("");
  });
});
