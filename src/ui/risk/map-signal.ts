// When to reload the map's reports and updates (WP-D D4b). Pure, so it can
// be tested with fake timers; useMapSignal.ts wires it to Supabase Realtime.
//
//   a "changed" signal  → reload after 1 s (several signals in that second
//                         make one reload)
//   every 60 s          → reload anyway, only while the page is visible
//                         (works without Realtime, and catches reports that
//                         expired, which sends no signal)
//   page shown again    → reload at once if it was hidden for 60 s or more
export const SIGNAL_DELAY_MS = 1_000;
export const POLL_MS = 60_000;

export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};

export function createReloader(reload: () => void, clock: Clock) {
  let pending: unknown = null;
  let last = clock.now();

  const run = () => {
    pending = null;
    last = clock.now();
    reload();
  };

  return {
    signal() {
      if (pending === null) pending = clock.setTimeout(run, SIGNAL_DELAY_MS);
    },
    tick(visible: boolean) {
      if (visible && pending === null && clock.now() - last >= POLL_MS) run();
    },
    shown() {
      if (pending === null && clock.now() - last >= POLL_MS) run();
    },
    stop() {
      if (pending !== null) clock.clearTimeout(pending);
      pending = null;
    },
  };
}
