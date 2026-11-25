import { defineRouting } from "next-intl/routing";

// English, Hindi and Urdu (BUILD_PROMPT section 12).
//
// The language lives in the rg_lang cookie, never in the URL
// (localePrefix "never"): proxy.ts rewrites /board to /ur/board inside the
// server, so links, the service worker and Clerk only ever see /board. The
// hidden [locale] folder lets Next build a cached page per language with the
// right <html lang dir> (docs/decisions.md, "Languages").
export const LOCALES = ["en", "hi", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "rg_lang";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  localePrefix: "never",
  // First visit with no cookie: the phone's language (Accept-Language) picks.
  localeDetection: true,
  localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365 },
});
