import "server-only";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import ur from "@/messages/ur.json";
import type { Locale } from "@/src/i18n/routing";
import { TIME_ZONE } from "@/src/i18n/locale";

// Translators for code that runs outside a page, such as the plain-text
// risk summary. Pages use getTranslations() instead.
const MESSAGES = { en, hi, ur } as const;

export function translatorFor(locale: Locale) {
  return createTranslator({ locale, messages: MESSAGES[locale] as typeof en, timeZone: TIME_ZONE });
}

export type ServerTranslator = ReturnType<typeof translatorFor>;
