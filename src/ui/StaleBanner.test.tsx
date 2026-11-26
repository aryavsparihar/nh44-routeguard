import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { STALE_AFTER_MINUTES } from "@/src/shared/freshness";

// The stale-data banner (BUILD_PROMPT section 15): shown when the newest run
// is older than the stale limit, and hidden when it is fresh. The health
// check's "stale" flag is tested in src/server/health/health.routes.test.ts
// with the same rule (src/shared/freshness.ts).
const health = vi.hoisted(() => ({ latestRunAt: vi.fn() }));
vi.mock("@/src/server/health/health.repository", () => health);
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages: en, namespace: namespace as "banner" }),
}));

const { StaleBanner } = await import("./StaleBanner");

// renderToStaticMarkup escapes apostrophes.
const html = (text: string) => text.replaceAll("'", "&#x27;");
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function render() {
  const element = await StaleBanner();
  return element ? renderToStaticMarkup(element) : "";
}

describe("StaleBanner", () => {
  beforeEach(() => health.latestRunAt.mockReset());

  it("shows when the newest run is older than the stale limit", async () => {
    health.latestRunAt.mockResolvedValue({ runAt: minutesAgo(STALE_AFTER_MINUTES + 30), failed: false });
    const out = await render();
    expect(out).toContain('role="status"');
    expect(out).toContain(en.banner.stale.split("{")[0].trim());
  });

  it("is hidden when the data is fresh", async () => {
    health.latestRunAt.mockResolvedValue({ runAt: minutesAgo(10), failed: false });
    expect(await render()).toBe("");
  });

  it("says so when there is no run, or the database can't be reached", async () => {
    health.latestRunAt.mockResolvedValue({ runAt: null, failed: false });
    expect(await render()).toContain(html(en.banner.noRun));
    health.latestRunAt.mockResolvedValue({ runAt: null, failed: true });
    expect(await render()).toContain(html(en.banner.dbDown));
  });
});
