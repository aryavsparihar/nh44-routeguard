import { getTranslations } from "next-intl/server";
import Link from "next/link";

// On every screen, in all three languages (BUILD_PROMPT section 10.1):
// RouteGuard is not an official service. No police logos or seals anywhere.
export async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 text-sm text-secondary">
      <p>{t("disclaimer")}</p>
      <p className="mt-2 flex gap-4">
        <a href="tel:112" className="font-bold text-apple-ink underline">
          {t("call112")}
        </a>
        <Link href="/privacy" className="underline">
          {t("privacy")}
        </Link>
      </p>
    </footer>
  );
}
