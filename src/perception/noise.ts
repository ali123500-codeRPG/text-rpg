// BG-57, HB1–HB5, PZ4: hearing by real metres. A sound's decibels at 1 m (CONFIG.NOISE_DB) weaken 20·log10(metres) with
// distance (the inverse-square law) and lose at each wall, shut way, floor or roof in the way what its material does at its
// thickness (D-199 a, plan/line.ts soundLossDb; an open gap nothing), by the straight line or the walking path, whichever
// keeps it louder. The listener hears it while it is at least HEARING_FLOOR_DB
// and clearly (who and what) from CLEAR_ABOVE_FLOOR_DB over it (per-zone background noise is parked: D-231).
import { CONFIG } from '../config';
import type { NoiseKey } from '../scales';
import type { Actor, GameState, Perception } from '../types';
import { floorGap, leastGapM, pointAt, walkThrough, withinM, type Located } from '../engine/position';
import { actorBody } from '../library';
import { lineLoss, openingLoss } from '../plan/line';

/** NV5: the noise of a spoken line by its volume (one table for the player's and NPCs' lines) */
export const VOLUME_NOISE = { whisper: 'hushed', normal: 'normal', shout: 'loud' } as const satisfies Record<import('../types').Volume, NoiseKey>;

/** the height a sound is made and heard at: a person's mouth and ears (a spot: as high as a person's) */
const earOf = (state: GameState, x: Located, floor: number): number => floor + ('core' in x ? actorBody(state, x as Actor).size.heightM * CONFIG.EYE_SHARE : 1.5);

/** PZ4 a: the decibels of a sound of this noise, made at `from`, where `to` stands (Keen Ear's `keenDb` adds); null for
 * silence or no way at all. The louder of two: the straight line (through every wall, shut way, floor and roof on it,
 * each losing what its material does at its thickness) and the walking path (each way on it losing what stands in it). */
export function soundDb(state: GameState, noise: NoiseKey | undefined, from: Located, to: Located, keenDb = 0, leanIn = false): number | null {
  const base = CONFIG.NOISE_DB[noise ?? 'normal'];
  if (base === null || base === undefined) return null;
  const A = pointAt(state, from), B = pointAt(state, to);
  const lineM = Math.hypot(floorGap(state, from, to), B.floor - A.floor);
  const lineDb = lineLoss(state, { x: A.x, y: A.y, z: earOf(state, from, A.floor) }, { x: B.x, y: B.y, z: earOf(state, to, B.floor) });
  // HB8: whispering to someone within reach with nothing between, the speaker leans in to their ear
  const near = leanIn && lineDb === 0 && withinM(lineM, CONFIG.WHISPER_REACH_M);
  const db = (m: number, loss: number) => base + keenDb - 20 * Math.log10(Math.max(m, CONFIG.NEAREST_M)) - loss;
  let best = near ? base + keenDb - 20 * Math.log10(CONFIG.WHISPER_LEAN_M) : db(lineM, lineDb);
  if (lineDb > 0) {
    const w = walkThrough(state, from, to);
    if (w) best = Math.max(best, db(w.metres, w.through.reduce((n, o) => n + openingLoss(state, o), 0)));
  }
  return best;
}

/** HB1: how well the listener hears it: 'full' (who and what) from CLEAR_ABOVE_FLOOR_DB over HEARING_FLOOR_DB, 'partial'
 * (a sound, not who) at the floor, else null */
export function hearingOf(state: GameState, noise: NoiseKey | undefined, from: Located, listener: Located, keenDb = 0, leanIn = false): Perception | null {
  // too far to reach the floor even with nothing in the way, at the nearest the two can be: not heard, without tracing
  // walls or a path (a whisper leant into an ear is louder than its distance says, so it is always traced)
  const base = CONFIG.NOISE_DB[noise ?? 'normal'];
  if (base === null || base === undefined) return null;
  if (!leanIn && base + keenDb - 20 * Math.log10(Math.max(leastGapM(state, from, listener), CONFIG.NEAREST_M)) < CONFIG.HEARING_FLOOR_DB) return null;
  const db = soundDb(state, noise, from, listener, keenDb, leanIn);
  if (db === null) return null;
  const floor = CONFIG.HEARING_FLOOR_DB;
  return db >= floor + CONFIG.CLEAR_ABOVE_FLOOR_DB ? 'full' : db >= floor ? 'partial' : null;
}

/** how many metres a sound of this noise carries in the open (no walls), [clearly, at all] (0: not even at NEAREST_M;
 * null: silence). For the library's noise table and the Keen Ear text. */
export function openAirReachM(noise: NoiseKey, keenDb = 0): [number, number] | null {
  const base = CONFIG.NOISE_DB[noise];
  if (base === null || base === undefined) return null;
  const floor = CONFIG.HEARING_FLOOR_DB;
  const far = (min: number) => { const m = 10 ** ((base + keenDb - min) / 20); return m < CONFIG.NEAREST_M ? 0 : Math.round(m); };
  return [far(floor + CONFIG.CLEAR_ABOVE_FLOOR_DB), far(floor)];
}
