import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LanguageSwitch } from "./LanguageSwitch";
import { SignInLink } from "./SignInLink";

// The title appears once (L3), with the language switch beside it.
export async function AppHeader() {
  const t = await getTranslations("header");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-elevated">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:bg-elevated focus:p-2"
      >
        {t("skip")}
      </a>
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-2">
        {/* dir="auto": the Latin title stays left-to-right on Urdu pages, so a cut lands at its end. */}
        <Link
          href="/"
          dir="auto"
          className="min-w-0 truncate font-heading text-base font-bold text-highway sm:text-xl"
        >
          {t("title")}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <SignInLink href="/me" className="flex min-h-12 items-center px-1 text-sm underline">
            {t("account")}
          </SignInLink>
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
