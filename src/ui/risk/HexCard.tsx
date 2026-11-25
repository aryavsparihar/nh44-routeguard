import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ReasonText } from "@/src/shared/reason";
import { HAZARDS, type Hazard, type Level } from "@/src/shared/risk";
import { LevelBadge } from "./LevelBadge";

// One H3 cell, picked by tapping the road on the map: its ID, zone, the
// score the map is colouring it by, its main hazard and its slope. All from
// GET /api/v1/risk/hexes; nothing is worked out here.
export type PickedHex = {
  id: string;
  zone: number | null;
  zoneName: string;
  level: Level;
  score: number;
  topHazard: string | null;
  slope: number | null;
  reason: ReasonText; // already in the reader's language (formatReason)
  confidence: string | null;
};

const CONFIDENCE = ["low", "medium", "high"] as const;
const isConfidence = (c: string | null): c is (typeof CONFIDENCE)[number] => CONFIDENCE.includes(c as never);

const isHazard = (h: string | null): h is Hazard => HAZARDS.includes(h as Hazard);

export function HexCard({ cell, when, onClose }: { cell: PickedHex; when: string; onClose: () => void }) {
  const t = useTranslations("risk");
  const row = "contents";
  // On a phone the card opens below the map, often under the bottom menu:
  // bring it into view for each new cell (scroll-mb clears the menu).
  const self = useRef<HTMLElement>(null);
  useEffect(() => {
    self.current?.scrollIntoView({ block: "nearest" });
  }, [cell.id]);
  return (
    <section
      ref={self}
      aria-labelledby="hex-card-title"
      aria-live="polite"
      className="scroll-mb-24 rounded-lg border border-border bg-elevated p-3 text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id="hex-card-title" className="pt-3 font-bold">
          {t("cell.title", { when })}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 shrink-0 rounded-md border border-border-strong px-3 font-bold"
        >
          {t("cell.close")}
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        <div className={row}>
          <dt className="text-secondary">{t("cell.id")}</dt>
          {/* IDs are Latin letters and digits: keep them left to right in Urdu. */}
          <dd dir="ltr" className="justify-self-start font-mono break-all">
            {cell.id}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-secondary">{t("cell.zone")}</dt>
          <dd>{cell.zone === null ? t("cell.unknown") : t("zoneTitle", { zone: cell.zone, name: cell.zoneName })}</dd>
        </div>
        <div className={row}>
          <dt className="text-secondary">{t("cell.risk")}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <LevelBadge level={cell.level} />
            {t("scoreLabel", { score: cell.score.toFixed(2) })}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-secondary">{t("cell.why")}</dt>
          <dd>
            <bdi>{cell.reason.text}</bdi>
            {cell.reason.english && (
              <span className="ms-2 rounded-sm bg-surface px-1 text-xs text-secondary">{t("englishTag")}</span>
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-secondary">{t("cell.confidence")}</dt>
          <dd>{isConfidence(cell.confidence) ? t(`confidence.${cell.confidence}`) : t("cell.unknown")}</dd>
        </div>
        <div className={row}>
          <dt className="text-secondary">{t("cell.mainHazard")}</dt>
          <dd>{isHazard(cell.topHazard) ? t(`hazard.${cell.topHazard}`) : t("cell.noHazard")}</dd>
        </div>
        <div className={row}>
          <dt className="text-secondary">{t("cell.slope")}</dt>
          <dd>{cell.slope === null ? t("cell.unknown") : t("cell.slopeValue", { slope: cell.slope.toFixed(1) })}</dd>
        </div>
      </dl>
    </section>
  );
}
