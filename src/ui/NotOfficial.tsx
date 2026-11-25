import { useTranslations } from "next-intl";

// The "not official" note next to police/TCU updates (BUILD_PROMPT sections
// 12 and 13): we copy them from a source, we are not that source. No logos,
// emblems or seals anywhere.
export function NotOfficial() {
  const t = useTranslations("updates");
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-surface p-2 text-sm text-secondary">
      <span aria-hidden="true">ⓘ</span>
      <span>{t("notOfficial")}</span>
    </p>
  );
}
