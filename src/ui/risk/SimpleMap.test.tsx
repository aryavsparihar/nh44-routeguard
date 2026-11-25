import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicReport } from "@/src/shared/api-types";
import { SimpleMap } from "./SimpleMap";

const base: PublicReport = {
  id: "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f",
  source: "driver",
  hazard_type: "rockfall",
  lat: 33.242,
  lng: 75.238,
  zone_id: 4,
  note: null,
  status: "unconfirmed",
  confirmations: 0,
  created_at: "2026-11-25T08:00:00.000Z",
  expires_at: "2026-11-25T14:00:00.000Z",
  has_photo: false,
  is_demo: false,
};

function render(reports: PublicReport[], placeName = "Ramban") {
  return renderToStaticMarkup(
    <SimpleMap
      segments={[
        { zone: 1, coords: [[74.86, 32.73], [75.13, 32.92]] },
        { zone: 2, coords: [[75.13, 32.92], [75.24, 33.24]] },
      ]}
      bounds={[
        [74.8, 32.7],
        [75.3, 34.1],
      ]}
      levels={{ 1: "high" }}
      reports={reports}
      places={[{ name: placeName, lng: 75.24, lat: 33.24 }]}
      label="Map of NH-44"
    />,
  );
}

describe("SimpleMap", () => {
  it("has one label for screen readers and hides the drawing", () => {
    const html = render([]);
    expect(html).toContain('role="img" aria-label="Map of NH-44"');
    expect(html).toContain('<svg aria-hidden="true"');
  });

  it("colours each zone by its level (low when unknown)", () => {
    const html = render([]);
    expect(html).toContain("stroke-risk-high");
    expect(html).toContain("stroke-risk-low");
    expect(html).not.toContain("stroke-risk-medium");
  });

  it("draws unconfirmed driver reports dashed and others solid", () => {
    const dashed = render([base]);
    const solid = render([{ ...base, status: "confirmed" }]);
    expect(dashed).toContain('stroke-dasharray="4 3"');
    expect(solid).not.toContain("stroke-dasharray");
  });

  it("writes town names as text, never HTML", () => {
    const html = render([], "<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
