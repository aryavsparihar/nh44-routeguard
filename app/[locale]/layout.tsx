import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { dirFor } from "@/src/i18n/locale";
import { routing, type Locale } from "@/src/i18n/routing";
import { AppHeader } from "@/src/ui/AppHeader";
import { BottomNav } from "@/src/ui/BottomNav";
import { Footer } from "@/src/ui/Footer";
import { StaleBanner } from "@/src/ui/StaleBanner";
import { fontVariables } from "@/src/ui/fonts";
import "../globals.css";

// The root layout, one cached copy per language. [locale] is filled in by
// proxy.ts from the rg_lang cookie and never shows in the URL
// (src/i18n/routing.ts).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = (await getLocale()) as Locale;
  return (
    <html lang={locale} dir={dirFor(locale)} className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <AppHeader />
          <Suspense fallback={null}>
            <StaleBanner />
          </Suspense>
          <main id="main" className="mx-auto w-full min-w-0 max-w-2xl flex-1 px-4 pt-4">
            {children}
          </main>
          <Footer />
          <BottomNav />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
