import { useTranslations } from "next-intl";
import type { Level } from "@/src/shared/risk";

// The level as words plus a shape (▲ medium, ▲▲ high), so it never relies
// on colour alone.
const STYLE: Record<Level, string> = {
  low: "bg-send-bg text-send-text",
  medium: "bg-hold-bg text-hold-text",
  high: "bg-high-bg text-high-text",
};
const MARK: Record<Level, string> = { low: "", medium: "▲ ", high: "▲▲ " };

export function LevelBadge({ level }: { level: Level }) {
  const t = useTranslations("risk.level");
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-bold ${STYLE[level]}`}>
      <span aria-hidden="true">{MARK[level]}</span>
      {t(level)}
    </span>
  );
}
