// Seeded RNG with saved state (mulberry32). Replay is exact given rngState.
import type { Rng } from './types';

export function createRng(state: number): Rng & { state: number } {
  let s = state >>> 0;
  const rng = {
    get state() {
      return s;
    },
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    d100() {
      return rng.int(1, 100);
    },
  };
  return rng;
}

/** Test helper: d100()/int() return queued values first (int clamps nothing), then fall back to the seeded stream. */
export function forcedRng(values: number[], seed = 1): Rng & { state: number; queue: number[] } {
  const base = createRng(seed);
  const queue = [...values];
  return {
    get state() {
      return base.state;
    },
    queue,
    next: () => base.next(),
    int: (min: number, max: number) => (queue.length ? queue.shift()! : base.int(min, max)),
    d100: () => (queue.length ? queue.shift()! : base.d100()),
  };
}
