import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("body")}</p>
      <Link href="/" className="underline">
        {t("home")}
      </Link>
    </section>
  );
}
