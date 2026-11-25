import "server-only";
import type { Locale } from "@/src/i18n/routing";
import { translatorFor } from "@/src/server/i18n/translator";
import { formatDayTime, isolate } from "@/src/shared/format";
import { HORIZONS, ZONE_IDS, type RiskRow } from "@/src/shared/risk";
import type { LatestRun } from "./risk.service";

// The low-signal summary (PPT feature 7): a few lines of plain text that load
// on a weak 2G connection. One line per horizon; zones that are medium or
// high are named, the rest are left out. Same words as the app (messages).
export const SUMMARY_MAX_BYTES = 5 * 1024;

export function riskSummary(run: LatestRun, locale: Locale): string {
  const t = translatorFor(locale);
  const lines = [t("summary.title")];

  if (!run.runAt || run.rows.length === 0) {
    lines.push(t("banner.noRun"));
  } else {
    lines.push(t("summary.scoresFrom", { time: isolate(formatDayTime(run.runAt, locale)) }));
    for (const h of HORIZONS) {
      const atH = run.rows.filter((row) => row.horizon_hours === h);
      const raised = ZONE_IDS.map((z) => atH.find((row) => row.zone_id === z)).filter(
        (row): row is RiskRow => !!row && row.level !== "low",
      );
      const when = t(`risk.horizon.h${h}`);
      const body = raised.length
        ? raised
            .map((row) =>
              t("summary.zoneLine", {
                zone: row.zone_id,
                level: t(`risk.level.${row.level}`),
                score: isolate(row.overall.toFixed(2)),
                hazard: row.top_hazard ? t(`risk.hazard.${row.top_hazard}`) : "-",
              }),
            )
            .join(t("summary.separator"))
        : t("summary.allLow");
      lines.push(t("summary.line", { when, body }));
    }
  }

  lines.push(t("footer.disclaimer"));
  return lines.join("\n") + "\n";
}
