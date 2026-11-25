// "12 minutes old", "2 hours old": how old a saved copy is, in words from the
// "offline" messages. Pass the offline translator: useTranslations("offline").
type AgeT = (key: "ageMinutes" | "ageHours", values: { minutes: number } | { hours: number }) => string;

export function ageText(t: AgeT, ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return minutes < 60 ? t("ageMinutes", { minutes }) : t("ageHours", { hours: Math.floor(minutes / 60) });
}
