// Turns a risk row's reason_code + reason_params into a sentence in the
// reader's language (L4). The risk job writes the code and params
// (lib/risk/reason_codes.json lists every code and its params); the words
// live in messages/{en,hi,ur}.json under "reason".
//
// If the code is unknown or a param looks wrong, we show the job's English
// sentence instead and say so (english: true), rather than a broken one.
// Runs in the browser too: no server-only imports here.
import reasonCodes from "@/lib/risk/reason_codes.json";
import points from "@/jobs/points.json";
import { isolate } from "./format";
import { EXPOSURE_BANDS, type RiskRow } from "./risk";

// A translator for the "reason" namespace: next-intl's t() from
// useTranslations("reason") or createTranslator({ namespace: "reason" }).
export type ReasonTranslate = (key: string, values?: Record<string, string | number>) => string;

export type ReasonText = { text: string; english: boolean };

const CODES = reasonCodes.codes as Record<string, string[]>;
const PLACE_IDS = new Set(points.points.map((p) => p.id));
const NUMBER_PARAMS = new Set(["mm", "hours", "burst_mm", "burst_hours", "snow_cm", "depth_m"]);

function validParam(name: string, value: unknown): boolean {
  if (NUMBER_PARAMS.has(name)) return typeof value === "number" && Number.isFinite(value) && value >= 0;
  switch (name) {
    case "zone":
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 6;
    case "place":
      return typeof value === "string" && PLACE_IDS.has(value);
    case "exposure":
      return EXPOSURE_BANDS.includes(value as (typeof EXPOSURE_BANDS)[number]);
    case "black_ice":
      return value === "yes" || value === "no";
    default:
      return false;
  }
}

// Same rounding as the job's English sentence: whole numbers from 10 up,
// one decimal below. depth_m keeps 2 decimals. Always Latin digits.
function num(name: string, value: number): string {
  if (name === "depth_m") return value.toFixed(2);
  return value >= 10 || value === 0 ? value.toFixed(0) : value.toFixed(1);
}

export function formatReason(
  row: Pick<RiskRow, "reason" | "reason_code" | "reason_params" | "top_hazard">,
  t: ReasonTranslate,
): ReasonText {
  const english = { text: row.reason, english: true };
  const code = row.reason_code;
  const params = row.reason_params;
  if (!code || !params || !(code in CODES)) return english;
  const names = CODES[code];
  if (!names.every((name) => validParam(name, params[name]))) return english;

  const v: Record<string, string | number> = {};
  for (const name of names) {
    const value = params[name];
    // Numbers are isolated so they keep their order inside Urdu text.
    v[name] = typeof value === "number" ? isolate(name === "zone" ? value : num(name, value)) : (value as string);
  }

  if (code === "none") return { text: t("none", { zone: v.zone }), english: false };

  let head: string;
  if (code === "snow_ice") {
    const parts: string[] = [];
    if ((params.snow_cm as number) > 0) parts.push(t("snowFresh", { snow_cm: v.snow_cm }));
    if ((params.depth_m as number) > 0) parts.push(t("snowDepth", { depth_m: v.depth_m }));
    if (params.black_ice === "yes") parts.push(t("blackIce"));
    head = t("snow_ice", { parts: parts.length ? parts.join(t("listSeparator")) : t("noSnow") });
  } else {
    head = t(code, v);
  }

  const hazard = row.top_hazard ?? "landslide";
  const tail = t(`exposure.${v.exposure}`, { zone: v.zone, hazard: t(`hazards.${hazard}`) });
  const place = t(`places.${v.place}`);
  return { text: t("sentence", { head, place, tail }), english: false };
}
