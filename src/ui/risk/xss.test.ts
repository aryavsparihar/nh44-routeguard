// A note with HTML in it must show as text on the map list, never run (the
// XSS row in docs/security.md). Rendered with React's server renderer, as
// the page's first paint is.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import type { PublicReport } from "@/src/shared/api-types";
import { RoadReports } from "./FeedLists";

const report: PublicReport = {
  id: "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f",
  source: "driver",
  hazard_type: "rockfall",
  lat: 33.242,
  lng: 75.238,
  zone_id: 4,
  note: `<script>alert("x")</script><img src=x onerror=alert(1)>`,
  status: "unconfirmed",
  confirmations: 0,
  created_at: "2026-11-25T08:00:00.000Z",
  expires_at: "2026-11-25T14:00:00.000Z",
  has_photo: false,
  is_demo: false,
};

describe("report notes", () => {
  it("render as text, not HTML", () => {
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "en",
        messages,
        timeZone: "Asia/Kolkata",
        children: createElement(RoadReports, { reports: [report] }),
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});
