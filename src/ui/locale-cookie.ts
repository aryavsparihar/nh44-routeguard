import { LOCALE_COOKIE, type Locale } from "@/src/i18n/routing";

// Saves the chosen language for a year. proxy.ts reads it on every page
// request. Not httpOnly: the language is not a secret, and the browser sets it.
export function saveLocaleCookie(locale: Locale): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax${secure}`;
}
