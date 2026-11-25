import { useLocale, useTranslations } from "next-intl";
import type { ReplaySummary } from "@/src/shared/api-types";
import { formatDate, isolate } from "@/src/shared/format";
import { HAZARDS, type Hazard } from "@/src/shared/risk";
import type { Locale } from "@/src/i18n/routing";

// Storm replays (GET /api/v1/risk/replays): a real past storm on the map,
// for showing RouteGuard on a dry day. The banner says plainly that it is
// not today, every time one is on screen.

const isHazard = (h: string): h is Hazard => HAZARDS.includes(h as Hazard);

export function useReplayText() {
  const t = useTranslations("risk");
  const locale = useLocale() as Locale;
  // The incident date at noon IST, so it is the same day in India.
  const date = (r: ReplaySummary) => formatDate(new Date(`${r.date}T12:00:00+05:30`), locale);
  const hazard = (r: ReplaySummary) => (isHazard(r.hazard) ? t(`hazard.${r.hazard}`) : r.hazard);
  return { date, hazard };
}

export function ReplayPicker({
  replays,
  value,
  onChange,
}: {
  replays: ReplaySummary[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations("risk");
  const text = useReplayText();
  if (replays.length === 0) return null;
  return (
    <label className="flex flex-col gap-1 text-sm font-bold">
      {t("replay.pick")}
      <select
        className="min-h-12 rounded-md border border-border-strong bg-elevated px-3 text-base font-normal"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{t("replay.live")}</option>
        {replays.map((r) => (
          <option key={r.id} value={r.id}>
            {t("replay.option", { date: isolate(text.date(r)), hazard: text.hazard(r), place: isolate(r.place) })}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReplayBanner({ replay, onBack }: { replay: ReplaySummary; onBack: () => void }) {
  const t = useTranslations("risk");
  const text = useReplayText();
  // Only links to the source the incident list itself cites (https).
  const safeUrl = /^https:\/\//.test(replay.source_url) ? replay.source_url : null;
  return (
    <section
      role="status"
      aria-labelledby="replay-title"
      className="flex flex-col gap-2 rounded-lg border-s-4 border-hold-fill bg-hold-bg p-3 text-hold-text"
    >
      <h2 id="replay-title" className="text-lg font-bold">
        {t("replay.bannerTitle")}
      </h2>
      <p>
        {t("replay.bannerText", { date: isolate(text.date(replay)), place: isolate(replay.place) })}{" "}
        {t("replay.reported", { hazard: text.hazard(replay) })}
      </p>
      <p className="text-sm">
        {safeUrl ? (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {t("replay.source", { publisher: replay.source_publisher })}
          </a>
        ) : (
          t("replay.source", { publisher: replay.source_publisher })
        )}
      </p>
      <p className="text-sm">{t("replay.hidden")}</p>
      <button
        type="button"
        onClick={onBack}
        className="min-h-12 self-start rounded-md border border-border-strong bg-elevated px-4 font-bold"
      >
        {t("replay.back")}
      </button>
    </section>
  );
}
