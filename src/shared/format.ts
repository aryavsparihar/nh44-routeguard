import { intlLocale, TIME_ZONE } from "@/src/i18n/locale";
import type { Locale } from "@/src/i18n/routing";

// Times are always shown in India time (IST) with Latin digits, in all three
// languages. Wrap the result in <bdi> so it doesn't scramble inside Urdu text.

// "16:07"
export function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

// "25 Nov, 16:07" (the month name in the page's language)
export function formatDayTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

// "23 Jan 2026" (the month name in the page's language), the IST date.
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// Wraps a number, time or code in Unicode "first strong isolate" marks, the
// plain-text version of <bdi>. Use it for values placed inside a translated
// sentence, so "16:07" or "+48 h" can't be reordered inside Urdu text.
export function isolate(value: string | number): string {
  return `⁨${value}⁩`;
}

// The site an https link points to, shown next to every source link so the
// reader sees where it goes before tapping (BUILD_PROMPT section 16, XSS):
// "tribuneindia.com". Null for anything that isn't a plain https URL.
export function sourceHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// rel for links to other sites that people typed in (official update sources,
// road status sources): no access to our window, no referrer, no ranking.
export const EXTERNAL_REL = "noopener noreferrer nofollow";
