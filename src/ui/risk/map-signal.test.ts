import { describe, expect, it, vi } from "vitest";
import { createReloader, POLL_MS, SIGNAL_DELAY_MS, type Clock } from "./map-signal";

function fakeClock() {
  let t = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let next = 1;
  const clock: Clock = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.push({ at: t + ms, fn, id });
      return id;
    },
    clearTimeout: (id) => {
      const i = timers.findIndex((x) => x.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  };
  const advance = (ms: number) => {
    t += ms;
    for (const timer of timers.filter((x) => x.at <= t)) {
      timers.splice(timers.indexOf(timer), 1);
      timer.fn();
    }
  };
  return { clock, advance };
}

describe("map reloader", () => {
  it("turns a burst of signals into one reload, a second later", () => {
    const { clock, advance } = fakeClock();
    const reload = vi.fn();
    const r = createReloader(reload, clock);
    r.signal();
    r.signal();
    advance(SIGNAL_DELAY_MS - 1);
    r.signal();
    expect(reload).not.toHaveBeenCalled();
    advance(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads every minute while visible, never while hidden", () => {
    const { clock, advance } = fakeClock();
    const reload = vi.fn();
    const r = createReloader(reload, clock);
    advance(POLL_MS);
    r.tick(false);
    expect(reload).not.toHaveBeenCalled();
    r.tick(true);
    expect(reload).toHaveBeenCalledTimes(1);
    advance(POLL_MS / 2);
    r.tick(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("a signal resets the minute", () => {
    const { clock, advance } = fakeClock();
    const reload = vi.fn();
    const r = createReloader(reload, clock);
    advance(POLL_MS - 2_000);
    r.signal();
    advance(SIGNAL_DELAY_MS);
    r.tick(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads when the page is shown again after a minute or more", () => {
    const { clock, advance } = fakeClock();
    const reload = vi.fn();
    const r = createReloader(reload, clock);
    advance(10_000);
    r.shown();
    expect(reload).not.toHaveBeenCalled();
    advance(POLL_MS);
    r.shown();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stop() cancels a waiting reload", () => {
    const { clock, advance } = fakeClock();
    const reload = vi.fn();
    const r = createReloader(reload, clock);
    r.signal();
    r.stop();
    advance(SIGNAL_DELAY_MS);
    expect(reload).not.toHaveBeenCalled();
  });
});
