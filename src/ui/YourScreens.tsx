"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MeProfile } from "@/src/shared/api-types";
import { screensFor } from "./role-links";
import { SignInLink } from "./SignInLink";

const linkClass =
  "flex min-h-12 items-center rounded-md border border-border-strong bg-elevated px-3 font-bold hover:border-highway";

// "Your screens" on /me: every screen this person can use, one tap each, so
// nobody has to type an address in the installed app (src/ui/role-links.ts).
export function YourScreens({ me }: { me: Pick<MeProfile, "role" | "approval"> }) {
  const t = useTranslations("me.screens");
  return (
    <nav aria-labelledby="your-screens" className="flex flex-col gap-2 rounded-lg border border-border bg-elevated p-4">
      <h2 id="your-screens" className="text-xl font-bold">
        {t("heading")}
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {screensFor(me).map((s) => (
          <li key={s.href}>
            {s.signIn ? (
              <SignInLink href={s.href} className={linkClass}>
                {t(s.key)}
              </SignInLink>
            ) : (
              <Link href={s.href} className={linkClass}>
                {t(s.key)}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
