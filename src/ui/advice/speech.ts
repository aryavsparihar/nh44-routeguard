// "Read aloud" for the advisor's answer (improves Round 1 feature 4, the
// dispatch advisor). Uses the browser's own speechSynthesis, so it needs no
// server and works offline with the phone's built-in voices.
//
// Rule: only a voice for the screen's language. Hindi or Urdu text read by an
// English voice comes out as nonsense, so with no matching voice the button
// is hidden instead.
import type { Locale } from "@/src/i18n/routing";

// The voice languages we accept for each screen language, best first.
// "ur-PK" voices read the same Urdu script as "ur-IN".
export const VOICE_LANGS: Record<Locale, string[]> = {
  en: ["en-IN", "en"],
  hi: ["hi-IN", "hi"],
  ur: ["ur-IN", "ur-PK", "ur"],
};

// The fields of SpeechSynthesisVoice we look at (a plain type, so tests can
// pass simple objects).
export type VoiceLike = { lang: string; localService: boolean; name: string };

// Does this voice's language tag (like "hi-IN" or "hi_IN") match the wanted
// tag? "en" matches any English voice; "en-IN" only Indian English.
function matches(voiceLang: string, wanted: string): boolean {
  const lang = voiceLang.replace("_", "-").toLowerCase();
  const want = wanted.toLowerCase();
  return want.includes("-") ? lang === want : lang === want || lang.startsWith(`${want}-`);
}

// The best voice for the screen's language, or null if the phone has none.
// Voices on the phone (localService) come first: they also work offline.
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: Locale): V | null {
  for (const wanted of VOICE_LANGS[locale]) {
    const found = voices.filter((v) => matches(v.lang, wanted));
    if (found.length > 0) return found.find((v) => v.localService) ?? found[0];
  }
  return null;
}

// The text to read: exactly the lines shown on screen, in order, joined with
// spaces. Empty lines are left out.
export function speechText(lines: readonly (string | null | undefined)[]): string {
  return lines
    .map((line) => (line ?? "").trim())
    .filter((line) => line.length > 0)
    .join(" ");
}
