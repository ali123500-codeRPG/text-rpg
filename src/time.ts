// Game clock (Ali, 07/11/2026, T1–T8). Code owns one clock: game minutes since midnight before day 1, kept in
// state.clocks.time. Claude never sets it; the Weaver picks the starting time of day once, at story start.
import { CONFIG } from './config';
import { LIGHT, TIME_OF_DAY, type TimeOfDay } from './scales';
import type { GameState, Light, Zone } from './types';

export const DAY_MINUTES = 24 * 60;
const from = (k: TimeOfDay): number => CONFIG.TIME_OF_DAY_FROM[k];

/** has the story's clock been set (false at story start and in saves from before the clock) */
export const clockSet = (state: GameState): boolean => state.clocks.time !== undefined;
/** game minutes now; an unset clock reads as day 1 at the start of day */
export const now = (state: GameState): number => state.clocks.time ?? from('day');
export const dayOf = (t: number): number => Math.floor(t / DAY_MINUTES) + 1;

export function timeOfDay(t: number): TimeOfDay {
  const m = ((t % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const keys = [...TIME_OF_DAY.keys].sort((a, b) => from(a) - from(b));
  return keys.filter((k) => m >= from(k)).at(-1) ?? keys.at(-1)!;
}

/** minutes from t until `k` next begins (a full day if it begins right now) */
export function minutesUntil(t: number, k: TimeOfDay): number {
  const m = ((t % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const d = (from(k) - m + DAY_MINUTES) % DAY_MINUTES;
  return d || DAY_MINUTES;
}

/** the time of day after `k` */
export const nextTimeOfDay = (k: TimeOfDay): TimeOfDay => TIME_OF_DAY.keys[(TIME_OF_DAY.pos(k) + 1) % TIME_OF_DAY.keys.length];

export function advanceClock(state: GameState, minutes: number): void {
  // rounded to 1/1000 minute so tenth-of-a-minute fight turns don't pile up float noise (run 18: 1202.1999999999998)
  state.clocks.time = Math.round((now(state) + minutes) * 1000) / 1000;
}

/** T8: the Weaver's starting time of day sets the clock to its start on day 1 */
export function startClock(state: GameState, k: TimeOfDay): void {
  state.clocks.time = from(k);
}

/** what views show: the day number and time of day, never minutes (T4/T5) */
export const timeView = (state: GameState): { day: number; timeOfDay: string } => ({ day: dayOf(now(state)), timeOfDay: TIME_OF_DAY.name(timeOfDay(now(state))) });

/** T3a: an outdoor zone is lit by the sky or its own lamps, whichever is brighter; indoors only its own light counts */
export function zoneLight(state: GameState, z: Pick<Zone, 'light' | 'outdoor'> | undefined): Light {
  const own = z?.light ?? 'bright';
  if (!z?.outdoor) return own;
  const sky = CONFIG.SKY_LIGHT[timeOfDay(now(state))] as Light;
  return LIGHT.pos(sky) < LIGHT.pos(own) ? sky : own;
}
