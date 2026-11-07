// Time sources for the windows and timeouts. The pipeline reads time only through a Clock.
import type { Clock } from '../types';

/** the browser clock */
export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve) => {
      if (ms <= 0 || signal?.aborted) return resolve();
      const t = setTimeout(done, ms);
      function done() {
        clearTimeout(t);
        signal?.removeEventListener('abort', done);
        resolve();
      }
      signal?.addEventListener('abort', done, { once: true });
    }),
};

type Timer = { at: number; seq: number; resolve: () => void };

/**
 * Virtual time for tests. sleep() resolves (never rejects) when time reaches it or its signal aborts.
 * auto (default): once every pending microtask has run, time jumps to the earliest timer, so concurrent
 * sleeps wake in time order with no manual stepping. Manual mode: call advance(ms).
 */
export class VirtualClock implements Clock {
  private t: number;
  private timers: Timer[] = [];
  private seq = 0;
  private flushing = false;
  constructor(start = 0, private auto = true) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0 || signal?.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer: Timer = { at: this.t + ms, seq: this.seq++, resolve };
      this.timers.push(timer);
      signal?.addEventListener('abort', () => {
        this.timers = this.timers.filter((x) => x !== timer);
        resolve();
      }, { once: true });
      if (this.auto) this.schedule();
    });
  }
  /** manual mode: move time forward, waking timers in order */
  async advance(ms: number): Promise<void> {
    const end = this.t + ms;
    for (;;) {
      await settle();
      const next = this.earliest();
      if (!next || next.at > end) break;
      this.fire(next);
    }
    this.t = end;
    await settle();
  }
  pending(): number {
    return this.timers.length;
  }
  private earliest(): Timer | undefined {
    return [...this.timers].sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
  }
  private fire(timer: Timer) {
    this.timers = this.timers.filter((x) => x !== timer);
    this.t = Math.max(this.t, timer.at);
    timer.resolve();
  }
  private schedule() {
    if (this.flushing) return;
    this.flushing = true;
    // a macrotask runs after all queued microtasks, so every concurrent sleep is registered by then
    setTimeout(() => {
      this.flushing = false;
      const next = this.earliest();
      if (!next) return;
      this.fire(next);
      if (this.timers.length) this.schedule();
    }, 0);
  }
}

function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
