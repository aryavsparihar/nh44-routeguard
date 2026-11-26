// "Play the storm" in replay mode (improves Round 1 feature 2, the 48-hour
// strip, shown on the map): steps the past storm from now to +12, +24 and
// +48 h, about two seconds a step, then stops. With reduced motion asked for,
// there is no Play button; the step buttons stay.
import { HORIZONS, type Horizon } from "@/src/shared/risk";

export const PLAY_STEP_MS = 2000;

// The step after this one, or null at +48 h (the end).
export function nextHorizon(h: Horizon): Horizon | null {
  const i = HORIZONS.indexOf(h);
  return i >= 0 && i < HORIZONS.length - 1 ? HORIZONS[i + 1] : null;
}

// Where Play starts: from the step on screen, or from "now" again after the end.
export function playStart(h: Horizon): Horizon {
  return nextHorizon(h) === null ? HORIZONS[0] : h;
}

// True when the phone asks for reduced motion, or we can't tell (then the
// step buttons are enough).
export function prefersReducedMotion(win: Pick<Window, "matchMedia"> | undefined): boolean {
  if (!win || typeof win.matchMedia !== "function") return true;
  return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
