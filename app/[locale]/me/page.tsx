import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requirePageSignIn } from "@/src/server/auth/page";
import { pushPublicKey } from "@/src/server/push/config";
import { MeScreen } from "@/src/ui/me/MeScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("me");
  return { title: t("heading") };
}

export default async function MePage() {
  const t = await getTranslations("me");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <MeGate />
      </Suspense>
    </section>
  );
}

// Reads the session at request time, so it sits inside <Suspense>
// (cacheComponents). Clerk's browser library is needed here to refresh the
// token after picking a role and to sign out. The VAPID public key for
// alerts is read here at request time (it is public by design).
async function MeGate() {
  await requirePageSignIn();
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-in" afterSignOutUrl="/">
      <MeScreen pushKey={pushPublicKey()} />
    </ClerkProvider>
  );
}
