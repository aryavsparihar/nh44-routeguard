import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmailCodeSignIn } from "@/src/ui/auth/EmailCodeSignIn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("heading"), robots: { index: false } };
}

// Our own sign-in page (proxy.ts sends signed-out visitors here). Clerk's
// browser library loads only on this page, /me and nowhere else.
export default async function SignInPage() {
  const t = await getTranslations("auth");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p>{t("intro")}</p>
      <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-in" afterSignOutUrl="/">
        <EmailCodeSignIn />
      </ClerkProvider>
      <p className="text-sm text-secondary">
        {t("privacyNote")}{" "}
        <Link href="/privacy" className="underline">
          {t("privacyLink")}
        </Link>
      </p>
    </section>
  );
}
