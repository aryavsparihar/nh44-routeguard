import type { Locale } from "./routing";

// Urdu is written right to left; English and Hindi left to right.
export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ur" ? "rtl" : "ltr";
}

// The Intl locale for numbers and dates: Indian conventions, and Latin digits
// in all three languages so truck numbers and times read the same everywhere
// (BUILD_PROMPT section 12; the Urdu reviewer may change this).
export function intlLocale(locale: Locale): string {
  return `${locale}-IN-u-nu-latn`;
}

export const TIME_ZONE = "Asia/Kolkata";

// The names shown in the language switch, each in its own script.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  ur: "اردو",
};
