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

// Wraps a number, time or code in Unicode "first strong isolate" marks, the
// plain-text version of <bdi>. Use it for values placed inside a translated
// sentence, so "16:07" or "+48 h" can't be reordered inside Urdu text.
export function isolate(value: string | number): string {
  return `⁨${value}⁩`;
}
