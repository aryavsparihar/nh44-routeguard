import { Suspense } from "react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { getDb } from "@/src/server/db";
import { latestRunAt } from "@/src/server/health/health.repository";
import { formatTime, isolate } from "@/src/shared/format";
import { dataAgeMinutes } from "@/src/shared/freshness";

async function LastRun() {
  await connection(); // read the database on every visit, not at build time
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  const { runAt } = await getDb()
    .then(latestRunAt)
    .catch(() => ({ runAt: null }));
  if (!runAt) return null; // the banner above already explains why
  return (
    <p className="text-sm text-secondary">
      {t("lastRun", { time: isolate(formatTime(runAt, locale)), minutes: dataAgeMinutes(runAt) })}
    </p>
  );
}

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p>{t("intro")}</p>
      <Suspense fallback={null}>
        <LastRun />
      </Suspense>
    </section>
  );
}
