import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import backtest from "@/lib/risk/backtest.json";
import type { Locale } from "@/src/i18n/routing";
import { EXTERNAL_REL, formatDate, isolate } from "@/src/shared/format";

// The backtest in the app (improves Round 1 feature 1, the live risk map: how
// far to trust its colours). Every number comes from lib/risk/backtest.json,
// which jobs/backtest.py writes in the same run as docs/backtest.md; a pytest
// checks the two agree. Nothing here is typed in by hand.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backtest");
  return { title: t("title") };
}

const REPO = "https://github.com/aryavsparihar/nh44-routeguard/blob/main";
const SOURCES = [
  { key: "sourceIncidents", href: `${REPO}/data/incidents.csv` },
  { key: "sourceFull", href: `${REPO}/docs/backtest.md` },
  { key: "sourceWeather", href: "https://open-meteo.com/" },
] as const;
const ROWS = [
  { key: "48h", label: "row48h" },
  { key: "24h", label: "row24h" },
  { key: "12h", label: "row12h" },
  { key: "on_the_day", label: "rowDay" },
] as const;

export default async function BacktestPage() {
  const t = await getTranslations("backtest");
  const locale = (await getLocale()) as Locale;
  // A YYYY-MM-DD date at noon India time, so it is the same day in India.
  const day = (iso: string) => isolate(formatDate(new Date(`${iso}T12:00:00+05:30`), locale));
  const n = (value: number) => isolate(String(value));

  if (backtest.status !== "ok") {
    return (
      <article className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p>{t("notRun")}</p>
      </article>
    );
  }

  const inc = backtest.incidents;
  const fa = backtest.false_alarms;

  return (
    <article className="flex flex-col gap-3 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("intro")}</p>
      <p className="font-bold">
        {t("range", { count: n(inc.count), from: day(inc.from), to: day(inc.to), withForecasts: n(inc.with_forecasts) })}
      </p>

      <h2>{t("hitsTitle")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2">
          <thead>
            <tr>
              <th scope="col" className="text-start">{t("colCheck")}</th>
              <th scope="col" className="text-start">{t("colZone")}</th>
              <th scope="col" className="text-start">{t("colHazard")}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="text-start font-normal">{t(row.label)}</th>
                <td>{t("of", { hits: n(backtest.hit_rate[row.key].hits), of: n(backtest.hit_rate[row.key].of) })}</td>
                <td>{t("of", { hits: n(backtest.right_hazard[row.key].hits), of: n(backtest.right_hazard[row.key].of) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {backtest.median_lead_time_h !== null && <p>{t("lead", { hours: n(backtest.median_lead_time_h) })}</p>}

      <h2>{t("falseTitle")}</h2>
      <p>
        {t("falseText", {
          from: day(fa.from),
          to: day(fa.to),
          lead: n(fa.lead_h),
          days: n(fa.alarm_days),
          zoneDays: n(fa.zone_days_scored),
          per30: n(fa.alarm_days_per_zone_per_30_days),
        })}
      </p>
      <p>{t("falseUpper")}</p>

      <h2>{t("limitTitle")}</h2>
      <ul className="list-disc ps-5">
        <li>{t("limitSmall", { count: n(inc.count) })}</li>
        <li>{t("limitTime")}</li>
        <li>{t("limitThresholds")}</li>
      </ul>

      <h2>{t("sourcesTitle")}</h2>
      <ul className="flex flex-col gap-1">
        {SOURCES.map((s) => (
          <li key={s.key}>
            <a href={s.href} target="_blank" rel={EXTERNAL_REL} className="inline-flex min-h-12 items-center underline">
              {t(s.key)}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-secondary">
        {t("generated", { model: isolate(backtest.model_version), date: day(backtest.generated_at.slice(0, 10)) })}
      </p>
    </article>
  );
}
