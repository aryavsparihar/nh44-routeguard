import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { dirFor } from "@/src/i18n/locale";
import { routing, type Locale } from "@/src/i18n/routing";
import { AppHeader } from "@/src/ui/AppHeader";
import { BottomNav } from "@/src/ui/BottomNav";
import { Footer } from "@/src/ui/Footer";
import { StaleBanner } from "@/src/ui/StaleBanner";
import { OfflineStatus } from "@/src/ui/offline/OfflineStatus";
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
    manifest: "/manifest.webmanifest",
    icons: { apple: "/icons/icon-192.png" },
  };
}

export const viewport: Viewport = { themeColor: "#005f3f" };

// The service worker (public/sw.js) runs in production builds only. Its URL
// carries the deploy's version, so each deploy installs a fresh worker.
const SW_VERSION = process.env.DEPLOYMENT_VERSION || "local";
const SW_ENABLED = process.env.NODE_ENV === "production";

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = (await getLocale()) as Locale;
  return (
    <html lang={locale} dir={dirFor(locale)} className={`${fontVariables} h-full antialiased`}>
      {/* Some phone browsers add attributes here before React starts
          (Chrome on iPhone: style="-webkit-text-size-adjust:100%"). This
          only stops the warning for <body>'s own attributes; text and
          children are still checked. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <NextIntlClientProvider>
          <AppHeader />
          <Suspense fallback={null}>
            <StaleBanner />
          </Suspense>
          <OfflineStatus version={SW_VERSION} register={SW_ENABLED} />
          <main id="main" className="mx-auto w-full min-h-dvh min-w-0 max-w-2xl flex-1 px-4 pt-4">
            {children}
          </main>
          <Footer />
          <BottomNav />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
