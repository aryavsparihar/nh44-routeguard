"use client";

import { useTranslations } from "next-intl";

export function Loading() {
  const t = useTranslations("risk");
  return (
    <p role="status" className="rounded-md bg-surface p-3 text-sm">
      {t("loading")}
    </p>
  );
}

export function LoadError({ retry }: { retry: () => void }) {
  const t = useTranslations("risk");
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-high-fill bg-high-bg p-3 text-high-text">
      <p>{t("loadError")}</p>
      <button type="button" onClick={retry} className="min-h-12 rounded-md border border-border-strong bg-elevated px-4 text-primary">
        {t("retry")}
      </button>
    </div>
  );
}
