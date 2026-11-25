import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StripScreen } from "@/src/ui/risk/StripScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("strip");
  return { title: t("heading") };
}

export default async function StripPage() {
  const t = await getTranslations("strip");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p>{t("intro")}</p>
      <StripScreen />
    </section>
  );
}
