// Character age (AG1–AG27). One saved number per actor, the game day it was born (Core.bornDay); age, life stage and the
// old-age decline are read from it, the clock and the race's life stages (RaceDef.ageStages).
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { groupsOf } from '../library/functionNames';
import { LIFE_STAGES, TALENTS, type LifeStageKey, type TalentKey } from '../scales';
import { DAY_MINUTES, advanceClock, now } from '../time';
import type { Actor, GameState, Rng } from '../types';

type Stages = Partial<Record<LifeStageKey, number>>;
const stagesOf = (raceId?: string): Stages | undefined => (raceId ? getLibrary().races?.[raceId]?.ageStages : undefined);
const startOf = (st: Stages, k: LifeStageKey): number => st[k] ?? 0;
const last = LIFE_STAGES.keys[LIFE_STAGES.keys.length - 1];
/** AG7: years per step past the last stage: the gap between the race's last two stages */
const beyondStep = (st: Stages): number => Math.max(1, startOf(st, last) - startOf(st, LIFE_STAGES.at(LIFE_STAGES.keys.length - 2)));

/** the game day now, with its fraction */
const today = (state: GameState): number => now(state) / DAY_MINUTES;
/** AG2: age in years, or undefined for an actor with no birth day (an ageless race) */
export const ageYears = (state: GameState, a: Actor): number | undefined =>
  a.core.bornDay === undefined || !stagesOf(a.core.raceId) ? undefined : (today(state) - a.core.bornDay) / CONFIG.YEAR_DAYS;
/** the birth day that makes someone `years` old now */
export const bornDayFor = (state: GameState, years: number): number => today(state) - years * CONFIG.YEAR_DAYS;

/** AG3, AG7: the life stage at `years` for a race, and how many steps past the last stage */
export function lifeStage(raceId: string | undefined, years: number): { key: LifeStageKey; plus: number } | undefined {
  const st = stagesOf(raceId);
  if (!st) return undefined;
  const key = [...LIFE_STAGES.keys].reverse().find((k) => years >= startOf(st, k)) ?? LIFE_STAGES.keys[0];
  return { key, plus: key === last ? Math.floor((years - startOf(st, last)) / beyondStep(st)) : 0 };
}
/** AG7: "Ancient", "Ancient++", from AGE_PLUS_NUMBER_FROM steps "Ancient +5" */
export const stageName = (s: { key: LifeStageKey; plus: number }): string =>
  LIFE_STAGES.name(s.key) + (s.plus >= CONFIG.AGE_PLUS_NUMBER_FROM ? ` +${s.plus}` : '+'.repeat(s.plus));
/** an actor's life stage word, or undefined when it has no age */
export function stageOf(state: GameState, a: Actor): string | undefined {
  const y = ageYears(state, a);
  const s = y === undefined ? undefined : lifeStage(a.core.raceId, y);
  return s && stageName(s);
}
/** AG16: "Age 31 · Adult" (own sheet, own agent, GM view); undefined when it has no age */
export function ageText(state: GameState, a: Actor): string | undefined {
  const y = ageYears(state, a), s = stageOf(state, a);
  return y === undefined || !s ? undefined : `Age ${Math.floor(y)} · ${s}`;
}

/** AG17, AG18: the share of effective skill an old body keeps: from the start of Old it halves every
 * (Ancient start − Old start) years, so it keeps falling and never reaches zero. 1 before then and for the ageless. */
export function ageKeeps(state: GameState, a: Actor): number {
  const y = ageYears(state, a), st = stagesOf(a.core.raceId);
  if (y === undefined || !st) return 1;
  const from = startOf(st, CONFIG.AGE_DECLINE_FROM), halfLife = startOf(st, last) - from;
  return y <= from || halfLife <= 0 ? 1 : 0.5 ** ((y - from) / halfLife);
}
/** AG19, AG20: the multiplier on a skill's effective value: body skills and the senses decline, the rest never do */
export const ageMult = (state: GameState, a: Actor, skill: string): number =>
  groupsOf(getLibrary().skills[skill]).some((g) => CONFIG.AGE_DECLINE_GROUPS.includes(g)) ? ageKeeps(state, a) : 1;

/** AG16: move the clock and log the player's new life stage when it changes (the turn says so in one line) */
export function advanceAging(state: GameState, minutes: number, log: (code: string, detail: Record<string, unknown>) => void): void {
  const was = stageOf(state, state.player);
  advanceClock(state, minutes);
  const is = stageOf(state, state.player);
  if (is && is !== was) log('stage_changed', { actorId: state.player.id, stage: is, years: Math.floor(ageYears(state, state.player)!) });
}

/** the years a stage runs, [start, end); the last stage runs one step (AG7) */
function span(st: Stages, k: LifeStageKey): [number, number] {
  const i = LIFE_STAGES.pos(k), lo = startOf(st, k);
  return [lo, i === LIFE_STAGES.keys.length - 1 ? lo + beyondStep(st) : startOf(st, LIFE_STAGES.at(i + 1))];
}

/** AG23: a talent's multiplier on training years; past the last row each step multiplies by CONFIG.TALENT_BEYOND_MULT, never zero */
export function talentMult(k: TalentKey): number {
  const n = Number(k.slice(7)), last = TALENTS.keys.length - 1;
  return n <= last ? CONFIG.TALENT_MULT[k] : CONFIG.TALENT_MULT[TALENTS.keys[last]] * CONFIG.TALENT_BEYOND_MULT ** (n - last);
}
/** AG23: a talent's name; past the last row the last name gains a + per step (Prodigy+, Prodigy++) */
export function talentName(k: TalentKey): string {
  const n = Number(k.slice(7)), last = TALENTS.keys.length - 1;
  return n <= last ? TALENTS.name(k as (typeof TALENTS.keys)[number]) : TALENTS.name(TALENTS.keys[last]) + '+'.repeat(n - last);
}
/** No children: the youngest anyone of a race may be, the start of CONFIG.YOUNGEST_STAGE; undefined for an ageless race */
export function youngestAge(raceId: string | undefined): number | undefined {
  const st = stagesOf(raceId);
  return st ? startOf(st, CONFIG.YOUNGEST_STAGE) : undefined;
}
/** AG12, AG21, AB7: the youngest age someone of a race can be after `training` years at a talent: the race's Youth start +
 * years × the talent's multiplier × the race's Adult start ÷ CONFIG.TRAINING_ADULT_AGE (a dog grows up 9 times faster than
 * a person, so it trains 9 times faster), never under its youngest age. Undefined for an ageless race. */
export function ageFloor(raceId: string | undefined, training: number, talent: TalentKey): number | undefined {
  const st = stagesOf(raceId);
  return st ? Math.max(youngestAge(raceId)!, startOf(st, LIFE_STAGES.at(1)) + training * talentMult(talent) * startOf(st, LIFE_STAGES.at(2)) / CONFIG.TRAINING_ADULT_AGE) : undefined;
}
/** AG14: whether a life stage has any year at or past the floor (the last stage always does) */
export function stageReaches(raceId: string | undefined, k: LifeStageKey, floor: number): boolean {
  const st = stagesOf(raceId);
  return !st || LIFE_STAGES.pos(k) === LIFE_STAGES.keys.length - 1 || span(st, k)[1] > floor;
}

/** AG13: a birth day drawn from the stages listed (or CONFIG.NPC_AGE_STAGES): a stage, then a year inside it. AG12: never
 * younger than `minAge` years nor the race's youngest age; a stage wholly under it rolls inside the stage that holds it instead. */
export function rollBornDay(state: GameState | null, raceId: string | undefined, stages: LifeStageKey[] | undefined, rng: Rng, minAge = 0): number | undefined {
  const st = stagesOf(raceId);
  if (!st) return undefined;
  const floor = Math.max(minAge, youngestAge(raceId)!);
  const from = stages?.length ? stages : CONFIG.NPC_AGE_STAGES;
  const pick = from[rng.int(1, from.length) - 1];
  let [lo, hi] = span(st, pick);
  if (floor > lo) {
    lo = floor;
    if (hi <= lo) { const end = span(st, lifeStage(raceId, floor)!.key)[1]; hi = end > lo ? end : lo + beyondStep(st); }
  }
  const years = lo + rng.next() * Math.max(0, hi - lo - 1 / CONFIG.YEAR_DAYS); // a day short of the end: the birth day rounds older
  return Math.floor((state ? today(state) : 0) - years * CONFIG.YEAR_DAYS);
}
