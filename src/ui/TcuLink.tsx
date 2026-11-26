"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { readTcuHint } from "./role-hint";
import { SignInLink } from "./SignInLink";

function subscribe(onChange: () => void) {
  window.addEventListener("rg:role", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("rg:role", onChange);
    window.removeEventListener("storage", onChange);
  };
}

// The header's "TCU desk" button, shown on every page once /me has seen an
// approved TCU account on this phone (src/ui/role-hint.ts). Hidden in the
// server-rendered page, which is the same for everyone.
export function TcuLink() {
  const t = useTranslations("header");
  const show = useSyncExternalStore(subscribe, () => readTcuHint(), () => false);
  if (!show) return null;
  return (
    <SignInLink href="/admin" className="flex min-h-12 items-center rounded-md border border-border-strong px-2 text-sm font-bold">
      {t("tcu")}
    </SignInLink>
  );
}
