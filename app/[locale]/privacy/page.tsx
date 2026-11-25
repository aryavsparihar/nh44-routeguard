import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PRIVACY_VERSION } from "@/src/shared/consent";
import { isolate } from "@/src/shared/format";

// The privacy notice in three languages (BUILD_PROMPT section 10.8, India's
// DPDP Act 2023): what we collect, why, how long, and how to delete it.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

const COLLECT = [
  "collectAccount",
  "collectProfile",
  "collectReports",
  "collectShipments",
  "collectLocation",
  "collectAlerts",
  "collectLogs",
] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <article className="flex flex-col gap-3 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-secondary">{t("version", { version: isolate(PRIVACY_VERSION) })}</p>
      <p>{t("intro")}</p>

      <h2>{t("collectTitle")}</h2>
      <ul className="list-disc ps-5">
        {COLLECT.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>

      <h2>{t("whyTitle")}</h2>
      <p>{t("why")}</p>

      <h2>{t("keepTitle")}</h2>
      <p>{t("keep")}</p>

      <h2>{t("consentTitle")}</h2>
      <p>{t("consent")}</p>

      <h2>{t("deleteTitle")}</h2>
      <p>{t("delete")}</p>

      <p className="font-bold">{t("emergency")}</p>
    </article>
  );
}
