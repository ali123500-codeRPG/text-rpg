// AE6 (RY1–RY5): a readied order. The player holds (after any move) and one step waits for a condition (READY_ON); the
// moment it comes true the step plays by itself as the main action. This file says when a condition has come true; the
// turn engine (resolve.ts) watches it within a fight turn and on the world clock outside one, and plays the step.
import type { Actor, GameEvent, GameState } from '../types';
import type { ReadyWhen } from '../scales';
import { allActors, countsInFight } from './relations';
import { armedCount, inSenses } from './comingNear';
import { distOrNull, reachesM, sightDistM, type Located } from './position';

const M_EPS = 1e-3;

/** what the watcher noted of everyone at the last check: where they stood, whether they were in its senses, still in the
 * fight (not down, yielded or run), and how many weapons they held */
export type ReadySeen = Map<string, { at: Located; sensed: boolean; counts: boolean; armed: number }>;

export function readySeen(state: GameState, w: Actor): ReadySeen {
  const sensed = inSenses(state, w);
  return new Map(allActors(state).map((x) => [x.id, {
    at: { zone: x.zone, ...(x.pos ? { pos: { ...x.pos } } : {}) }, sensed: sensed.has(x.id), counts: countsInFight(x), armed: armedCount(state, x),
  }]));
}

/** whom the condition names: one actor, everyone of a band, or anyone outside the watcher's band */
export const readyNames = (w: Actor, when: ReadyWhen, x: Actor): boolean =>
  x !== w && (when.who === 'anyone' ? !(w.bandId && x.bandId === w.bandId) : x.id === when.who || x.bandId === when.who);

/** who made the condition come true since `seen` (events: what happened since then), in actor order. `reachM(x)`: the
 * readied step's reach at x in metres, null when it cannot be done to x (closes); `fled`: who ran this turn */
export function readyHits(state: GameState, w: Actor, when: ReadyWhen, seen: ReadySeen, events: GameEvent[], reachM: (x: Actor) => number | null, fled: ReadonlySet<string> = new Set()): string[] {
  const sensed = when.on === 'comes' || when.on === 'leaves' ? inSenses(state, w) : undefined;
  const me = seen.get(w.id)?.at ?? w;
  return allActors(state).filter((x) => {
    if (!readyNames(w, when, x)) return false;
    const was = seen.get(x.id);
    switch (when.on) {
      case 'comes': return sensed!.has(x.id) && !was?.sensed;
      case 'attacks': return events.some((e) => e.kind === 'attack' && e.actorId === x.id && e.target === (when.at ?? w.id));
      case 'down': return !!was?.counts && (!countsInFight(x) || fled.has(x.id));
      case 'closes': { const r = reachM(x); return r !== null && countsInFight(x) && reachesM(sightDistM(state, w, x), r) && (!was || !reachesM(sightDistM(state, me, was.at), r)); }
      case 'draws': return !!was && armedCount(state, x) > was.armed;
      case 'moves': return !!was && (x.zone !== was.at.zone || (distOrNull(state, x, was.at) ?? 0) > M_EPS);
      case 'leaves': return !!was?.sensed && (!sensed!.has(x.id) || x.zone !== was.at.zone);
    }
  }).map((x) => x.id);
}

/** RQ6 a: the condition already holds as the player readies (someone it names already within the step's reach); the step
 * then plays at once. The other conditions are things that happen, so none holds before it is watched */
export function readyAlready(state: GameState, w: Actor, when: ReadyWhen, reachM: (x: Actor) => number | null): string[] {
  if (when.on !== 'closes') return [];
  return allActors(state).filter((x) => { const r = readyNames(w, when, x) && countsInFight(x) ? reachM(x) : null; return r !== null && reachesM(sightDistM(state, w, x), r); }).map((x) => x.id);
}

/** RY2 a (a spear): the second at which x came within `reach` metres of the watcher, walking straight from d0 metres off to
 * d1 over seconds s0 to s1 of the turn */
export const crossedAt = (d0: number, d1: number, reach: number, s0: number, s1: number): number =>
  d0 <= reach || d0 - d1 <= M_EPS ? s0 : s0 + (s1 - s0) * Math.min(1, (d0 - reach) / (d0 - d1));
