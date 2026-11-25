import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdvisorScreen } from "@/src/ui/advice/AdvisorScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("advice");
  return { title: t("heading") };
}

export default async function AdvisorPage() {
  const t = await getTranslations("advice");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p>{t("intro")}</p>
      <AdvisorScreen />
    </section>
  );
}
