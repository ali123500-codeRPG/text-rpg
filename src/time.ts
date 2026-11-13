// Game clock (T1–T8). Code owns one clock: game minutes since midnight before day 1 of the Universe calendar (HF22),
// kept in state.clocks.time. Claude never sets it; the Weaver picks the starting time of day once, at story start.
import { CONFIG } from './config';
import { LIGHT, TIME_OF_DAY, type TimeOfDay } from './scales';
import type { GameState, Light, Zone } from './types';

export const DAY_MINUTES = 24 * 60;
/** how long something took, in game words: "2 h 5 min", "45 min", "3 h" ("0 min" for nothing) */
export function durationText(minutes: number): string {
  const m = Math.round(minutes), h = Math.floor(m / 60), r = m % 60;
  return [h ? `${h} h` : '', r || !h ? `${r} min` : ''].filter(Boolean).join(' ');
}
/** a span in whole days when it is at least one ("3 days"), else as durationText */
export const spanText = (minutes: number): string => minutes >= DAY_MINUTES && minutes % DAY_MINUTES === 0 ? `${minutes / DAY_MINUTES} day${minutes === DAY_MINUTES ? '' : 's'}` : durationText(minutes);
/** a clock time of day from game minutes, as 24-hour "07:30" */
export function clockText(minutes: number): string {
  const d = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
}
const from = (k: TimeOfDay): number => CONFIG.TIME_OF_DAY_FROM[k];

/** has the story's clock been set (false at story start and in saves from before the clock) */
export const clockSet = (state: GameState): boolean => state.clocks.time !== undefined;
/** HF22: the day the story's world started on the Universe calendar (1 for the first world) */
const startDay = (state: GameState): number => state.clocks.startDay ?? 1;
/** game minutes now; an unset clock reads as the start day, at the start of day */
export const now = (state: GameState): number => state.clocks.time ?? (startDay(state) - 1) * DAY_MINUTES + from('morning');
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
  // rounded to a millionth of a minute so short actions (0.4 s a word) keep their time but float noise doesn't pile up (run 18: 1202.1999999999998)
  state.clocks.time = Math.round((now(state) + minutes) * 1e6) / 1e6;
}

/** AT15: game minutes when turn `t` ended; the turn being resolved (or a later one) is now. A turn not kept reads as the
 * earliest kept turn after it, so an old stamp only ever looks younger than it is */
export function turnTime(state: GameState, t: number): number {
  if (t >= state.turn) return now(state);
  const ends = state.turnEnds ?? {};
  if (ends[t] !== undefined) return ends[t];
  const after = Object.keys(ends).map(Number).filter((k) => k > t);
  return after.length ? ends[Math.min(...after)] : now(state);
}
/** AT15: game seconds from turn `t` to now, or to the end of turn `upTo` (a stamp left unset, or never: forever) */
export const secondsSince = (state: GameState, t: number | undefined, upTo?: number): number =>
  t === undefined || !Number.isFinite(t) ? Infinity : ((upTo === undefined ? now(state) : turnTime(state, upTo)) - turnTime(state, t)) * 60;
/** AT15: note when this turn ended, keeping the last TURN_ENDS_KEPT */
export function noteTurnEnd(state: GameState): void {
  const ends = (state.turnEnds ??= {});
  ends[state.turn] = now(state);
  for (const k of Object.keys(ends)) if (Number(k) <= state.turn - CONFIG.TURN_ENDS_KEPT) delete ends[Number(k)];
}

/** T8: the Weaver's starting time of day sets the clock to its start on the story's start day */
export function startClock(state: GameState, k: TimeOfDay): void {
  state.clocks.time = (startDay(state) - 1) * DAY_MINUTES + from(k);
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
