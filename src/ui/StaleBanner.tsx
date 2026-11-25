import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { Locale } from "@/src/i18n/routing";
import { getDb } from "@/src/server/db";
import { latestRunAt } from "@/src/server/health/health.repository";
import { formatTime, isolate } from "@/src/shared/format";
import { dataAgeMinutes, isStale } from "@/src/shared/freshness";

// Shown on every screen when the scores are older than 90 minutes, when no
// run exists yet, or when the database can't be reached (BUILD_PROMPT
// section 15). Nothing is shown when the data is fresh.
export async function StaleBanner() {
  await connection(); // checked on every visit, not at build time
  const t = await getTranslations("banner");
  const locale = (await getLocale()) as Locale;

  const { runAt, failed } = await getDb()
    .then(latestRunAt)
    .catch(() => ({ runAt: null, failed: true }));

  let text: string | null = null;
  if (failed) text = t("dbDown");
  else if (!runAt) text = t("noRun");
  else if (isStale(dataAgeMinutes(runAt))) text = t("stale", { time: isolate(formatTime(runAt, locale)) });
  if (!text) return null;

  return (
    <div role="status" className="border-b border-hold-fill bg-hold-bg px-4 py-2 text-sm text-hold-text">
      <p className="mx-auto max-w-2xl">{text}</p>
    </div>
  );
}
