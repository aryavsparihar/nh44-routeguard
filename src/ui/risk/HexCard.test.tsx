import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";
import type { ModelGap } from "@/src/shared/model-gaps";
import { tippingPoint } from "@/src/shared/tipping";
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
  reason: { text: "Rain 27 mm in 48 h near Ramban", english: false },
  confidence: "medium",
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
    expect(html).toContain("<bdi>Rain 27 mm in 48 h near Ramban</bdi>");
    expect(html).toContain("Medium confidence");
    expect(html).not.toContain("English only");
  });

  it("tags a reason that fell back to the job's English", () => {
    expect(render({ ...RAMBAN, reason: { text: "x", english: true } })).toContain("English only");
  });

  it("says so when there is no hazard or no slope", () => {
    const html = render({ ...RAMBAN, level: "low", score: 0, topHazard: null, slope: null, confidence: null });
    expect(html).toContain("<dd>None</dd>");
    expect(html.match(/<dd>Not known<\/dd>/g)).toHaveLength(2); // confidence and slope
    expect(html).toContain("Score 0.00");
  });

  it("shows 'Not known' for fields missing from an older saved copy, instead of crashing", () => {
    const old = { ...RAMBAN, slope: undefined, confidence: undefined, reason: { text: "", english: true } };
    const html = render(old as unknown as PickedHex);
    expect(html.match(/<dd>Not known<\/dd>/g)).toHaveLength(3); // why, confidence, slope
    expect(html).not.toContain("English only");
  });

  it("ignores a hazard name it doesn't know instead of breaking", () => {
    expect(render({ ...RAMBAN, topHazard: "<b>x</b>" })).toContain("<dd>None</dd>");
  });

  it("keeps the ID left to right in Urdu", () => {
    expect(render(RAMBAN, "ur")).toMatch(/<dd dir="ltr"[^>]*>883d308abdfffff<\/dd>/);
  });

  it("says when confirmed reports here disagree with the model, and that the score stays", () => {
    const gap = { id: RAMBAN.id, zone: 4, hazard: "landslide", score: 0.12, reports: [{}, {}] } as unknown as ModelGap;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kolkata">
        <HexCard cell={RAMBAN} when="right now" onClose={() => {}} gaps={[gap]} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Reports and the model disagree here");
    expect(html).toContain("Landslide: 2 confirmed reports, but the model&#x27;s score is 0.12 (Low).");
    expect(html).toContain("The score stays as the weather model made it.");
    expect(render(RAMBAN)).not.toContain("disagree");
  });

  it("shows the rain that tips the cell's landslide score, labelled as our own values", () => {
    const tipping = tippingPoint({ zone: 4, slope: 35, reasonCode: "landslide_rain", reasonParams: { mm: 24, hours: 72 } });
    const html = render({ ...RAMBAN, tipping });
    expect(html).toContain("Medium from 37 mm of rain in 72 h");
    expect(html).toContain("High from 67 mm of rain in 72 h");
    expect(html).toContain("Rain the model used for this time: 24 mm in 72 h.");
    expect(html).toContain("not sourced figures");
    expect(html).not.toContain("cap the landslide score");
  });

  it("says when rain alone can't make the cell high, and the score it stops at", () => {
    const html = render({ ...RAMBAN, tipping: tippingPoint({ zone: 4, slope: 17.5, reasonCode: null, reasonParams: null }) });
    expect(html).toContain("Medium from 63 mm of rain in 72 h");
    expect(html).toContain("Rain alone can&#x27;t make it High here");
    expect(html).toContain("cap the landslide score at 0.40.");
    expect(html).not.toContain("Rain the model used");
  });
});
