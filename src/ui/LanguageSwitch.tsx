"use client";

import { useLocale, useTranslations } from "next-intl";
import { LOCALE_LABELS } from "@/src/i18n/locale";
import { LOCALES, type Locale } from "@/src/i18n/routing";
import { saveLocaleCookie } from "./locale-cookie";

// EN / हिन्दी / اردو. The choice goes into the rg_lang cookie, and the page
// reloads, because the language changes the whole page: <html lang dir>,
// fonts and every word (proxy.ts reads the cookie).
export function LanguageSwitch() {
  const current = useLocale() as Locale;
  const t = useTranslations("header");

  function choose(locale: Locale) {
    if (locale === current) return;
    saveLocaleCookie(locale);
    window.location.reload();
  }

  return (
    <div role="group" aria-label={t("language")} className="flex shrink-0 gap-1">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          onClick={() => choose(locale)}
          className="min-h-12 rounded-md border border-border-strong px-2 text-sm aria-pressed:bg-highway aria-pressed:text-inverse"
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
