import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { TIME_ZONE } from "./locale";

// The locale comes from the hidden [locale] folder (filled in by proxy.ts
// from the rg_lang cookie), read through next/root-params. Reading it this
// way, instead of reading the cookie here, keeps every page cacheable
// (cacheComponents).
export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const value = await rootParams.locale();
    if (!hasLocale(routing.locales, value)) notFound();
    locale = value;
  }
  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
