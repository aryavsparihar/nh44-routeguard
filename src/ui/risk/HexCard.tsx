import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/src/i18n/routing";
import type { PastClosure } from "@/src/shared/api-types";
import { EXTERNAL_REL, formatDate, isolate } from "@/src/shared/format";
import type { ModelGap } from "@/src/shared/model-gaps";
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

export function HexCard({
  cell,
  when,
  onClose,
  closures = null,
  gaps = null,
}: {
  cell: PickedHex;
  when: string;
  onClose: () => void;
  // Verified past closures nearest to this cell (src/shared/cell-closures.ts);
  // null while they load or when they couldn't be read.
  closures?: { here: PastClosure[]; total: number } | null;
  // Confirmed reports here that the model scores Low (src/shared/model-gaps.ts).
  gaps?: ModelGap[] | null;
}) {
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
            {cell.reason.text ? <bdi>{cell.reason.text}</bdi> : t("cell.unknown")}
            {cell.reason.text && cell.reason.english && (
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
          <dd>
            {typeof cell.slope === "number" ? t("cell.slopeValue", { slope: cell.slope.toFixed(1) }) : t("cell.unknown")}
          </dd>
        </div>
      </dl>
      {gaps && gaps.length > 0 && (
        <div className="mt-3 rounded-md border-2 border-dashed border-rail-fill p-2">
          <h4 className="font-bold">{t("gaps.cellHeading")}</h4>
          <ul className="flex flex-col gap-1">
            {gaps.map((g) => (
              <li key={g.hazard}>
                {t("gaps.cellItem", {
                  hazard: t(`hazard.${g.hazard}`),
                  count: g.reports.length,
                  score: g.score.toFixed(2),
                  level: t("level.low"),
                })}
              </li>
            ))}
          </ul>
          <p className="text-xs text-secondary">{t("gaps.cellNote")}</p>
        </div>
      )}
      {closures && <CellClosures here={closures.here} total={closures.total} />}
    </section>
  );
}

function CellClosures({ here, total }: { here: PastClosure[]; total: number }) {
  const t = useTranslations("risk");
  const locale = useLocale() as Locale;
  const day = (iso: string) => isolate(formatDate(new Date(`${iso}T12:00:00+05:30`), locale));
  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2">
      <h4 className="font-bold">{t("cell.closures.heading")}</h4>
      {here.length === 0 ? (
        <p className="text-sm">{t("cell.closures.none", { count: total })}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2 text-sm">
            {here.map((c) => (
              <li key={c.id}>
                <span>
                  {t("cell.closures.item", {
                    date: day(c.date),
                    hazard: isHazard(c.hazard_type) ? t(`hazard.${c.hazard_type}`) : c.hazard_type,
                    place: isolate(c.place),
                  })}
                  {c.hours_closed !== null && `, ${t("cell.closures.hours", { hours: c.hours_closed })}`}
                </span>{" "}
                {/^https:\/\//.test(c.source_url) ? (
                  <a href={c.source_url} target="_blank" rel={EXTERNAL_REL} className="inline-flex min-h-12 items-center underline">
                    {t("cell.closures.source", { publisher: c.source_publisher })}
                  </a>
                ) : (
                  <span>{t("cell.closures.source", { publisher: c.source_publisher })}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-secondary">{t("cell.closures.approx")}</p>
        </>
      )}
    </div>
  );
}
