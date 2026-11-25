import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";
import { HexCard, type PickedHex } from "./HexCard";

// A real resolution-8 cell at Ramban (data/corridor_hexes.csv, hex_slope.csv).
const RAMBAN: PickedHex = {
  id: "883d308abdfffff",
  zone: 4,
  zoneName: "Ramban → Ramsoo",
  level: "medium",
  score: 0.42,
  topHazard: "rockfall",
  slope: 16.6,
};

function render(cell: PickedHex, locale: "en" | "ur" = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ur} timeZone="Asia/Kolkata">
      <HexCard cell={cell} when="right now" onClose={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("HexCard", () => {
  it("shows the cell's ID, zone, level, score, main hazard and slope", () => {
    const html = render(RAMBAN);
    expect(html).toContain("This cell right now");
    expect(html).toContain("883d308abdfffff");
    expect(html).toContain("Zone 4: Ramban → Ramsoo");
    expect(html).toContain("Medium");
    expect(html).toContain("Score 0.42");
    expect(html).toContain("Rockfall");
    expect(html).toContain("16.6°");
  });

  it("says so when there is no hazard or no slope", () => {
    const html = render({ ...RAMBAN, level: "low", score: 0, topHazard: null, slope: null });
    expect(html).toContain("<dd>None</dd>");
    expect(html).toContain("<dd>Not known</dd>");
    expect(html).toContain("Score 0.00");
  });

  it("ignores a hazard name it doesn't know instead of breaking", () => {
    expect(render({ ...RAMBAN, topHazard: "<b>x</b>" })).toContain("<dd>None</dd>");
  });

  it("keeps the ID left to right in Urdu", () => {
    expect(render(RAMBAN, "ur")).toMatch(/<dd dir="ltr"[^>]*>883d308abdfffff<\/dd>/);
  });
});
