import { Suspense } from "react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { getDb } from "@/src/server/db";
import { latestRunAt } from "@/src/server/health/health.repository";
import { corridorBounds, corridorSegments } from "@/src/shared/corridor";
import { formatTime, isolate } from "@/src/shared/format";
import { dataAgeMinutes } from "@/src/shared/freshness";
import { RiskScreen } from "@/src/ui/risk/RiskScreen";
import { SignInLink } from "@/src/ui/SignInLink";

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

// The road line is cut into zones once, at build time.
const SEGMENTS = corridorSegments();
const BOUNDS = corridorBounds(SEGMENTS);

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p>{t("intro")}</p>
      <Suspense fallback={null}>
        <LastRun />
      </Suspense>
      <RiskScreen segments={SEGMENTS} bounds={BOUNDS} />
      <JoinCard />
    </section>
  );
}

// How to join: sign in with an email code, pick a role, TCU approves it.
// Everything above works without an account.
async function JoinCard() {
  const t = await getTranslations("home.join");
  return (
    <aside aria-labelledby="join" className="flex flex-col gap-2 rounded-lg border border-border bg-elevated p-4">
      <h2 id="join" className="text-lg font-bold">
        {t("heading")}
      </h2>
      <p>{t("text")}</p>
      <SignInLink
        href="/me"
        className="flex min-h-12 w-fit items-center rounded-md bg-highway px-4 font-bold text-inverse"
      >
        {t("button")}
      </SignInLink>
    </aside>
  );
}
