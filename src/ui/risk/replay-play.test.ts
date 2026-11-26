import { describe, expect, it } from "vitest";
import { HORIZONS, type Horizon } from "@/src/shared/risk";
import { PLAY_STEP_MS, nextHorizon, playStart, prefersReducedMotion } from "./replay-play";

describe("Play the storm", () => {
  it("steps now → +12 → +24 → +48 and stops there", () => {
    const seen: Horizon[] = [0];
    for (let h = nextHorizon(0); h !== null; h = nextHorizon(h)) seen.push(h);
    expect(seen).toEqual([...HORIZONS]);
    expect(nextHorizon(48)).toBeNull();
  });

  it("starts from the step on screen, or from now after the end", () => {
    expect(playStart(0)).toBe(0);
    expect(playStart(24)).toBe(24);
    expect(playStart(48)).toBe(0);
  });

  it("takes about two seconds a step", () => {
    expect(PLAY_STEP_MS).toBe(2000);
  });

  it("has no Play when reduced motion is asked for, or the browser can't tell us", () => {
    const media = (reduce: boolean) => ({ matchMedia: (q: string) => ({ matches: reduce && q.includes("reduce") }) as MediaQueryList });
    expect(prefersReducedMotion(media(true))).toBe(true);
    expect(prefersReducedMotion(media(false))).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(true);
  });
});
