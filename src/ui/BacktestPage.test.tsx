import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import ur from "@/messages/ur.json";
import backtest from "@/lib/risk/backtest.json";
import { LOCALES, type Locale } from "@/src/i18n/routing";

// The /backtest page (app/[locale]/backtest/page.tsx). Its numbers must be
// the ones in lib/risk/backtest.json; jobs/tests/test_backtest.py checks that
// file agrees with docs/backtest.md.
const MESSAGES = { en, hi, ur };
const current = vi.hoisted(() => ({ locale: "en" as string }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => current.locale,
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: current.locale, messages: MESSAGES[current.locale as Locale], namespace: namespace as "backtest" }),
}));

const { default: BacktestPage } = await import("@/app/[locale]/backtest/page");

async function render(locale: Locale) {
  current.locale = locale;
  // Without the direction marks around numbers, so plain text can be matched.
  return renderToStaticMarkup(await BacktestPage()).replace(/[⁨⁩]/g, "");
}

describe("/backtest", () => {
  it("shows the hits, the false alarms, the range and the count from the JSON", async () => {
    const html = await render("en");
    const h = backtest.hit_rate;
    expect(html).toContain(`${h["48h"].hits} of ${h["48h"].of}`);
    expect(html).toContain(`${h.on_the_day.hits} of ${h.on_the_day.of}`);
    expect(html).toContain(`${backtest.right_hazard["24h"].hits} of ${backtest.right_hazard["24h"].of}`);
    expect(html).toContain(`${backtest.false_alarms.alarm_days} alarm days across ${backtest.false_alarms.zone_days_scored} zone-days`);
    expect(html).toContain(`about ${backtest.false_alarms.alarm_days_per_zone_per_30_days} per zone`);
    expect(html).toContain(`${backtest.incidents.count} verified incidents`);
    expect(html).toContain("2018"); // first incident year (incidents.from)
  });

  it("says the sample is small and links the sources", async () => {
    const html = await render("en");
    expect(html).toContain(`There are only ${backtest.incidents.count} verified incidents`);
    expect(html).toContain("upper bound");
    expect(html).toContain("data/incidents.csv");
    expect(html).toContain("docs/backtest.md");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it.each(LOCALES)("renders in %s with every number", async (locale) => {
    const html = await render(locale);
    expect(html).toContain(String(backtest.false_alarms.alarm_days));
    expect(html).toContain(String(backtest.incidents.with_forecasts));
    expect(html).not.toContain(">backtest."); // no raw message keys
  });
});
