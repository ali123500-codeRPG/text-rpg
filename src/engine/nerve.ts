// BF79: a broken nerve may walk or run away, never toward a foe; at Cowering (below Broken) it may not walk at all.
// One rule for every walk: the player's, an NPC's, a flee (resolve.ts walk asks it before any walk runs).
import type { Actor, GameState } from '../types';
import { isBrokenLevel, isCoweringLevel, moraleLevel } from '../ruleset/morale';
import { allActors, countsInFight, foe, stance } from './relations';
import { distOrNull, M_EPS, type Located } from './position';

/** broken: the bar at Broken or below, or an NPC whose break still holds (it lasts the scenario, BG-199) */
export const nerveBroken = (a: Actor): boolean => a.mind?.moraleState === 'broken' || (!a.mind?.moraleState && isBrokenLevel(moraleLevel(a)));
/** at Cowering: not even a walk away */
export const nerveCowers = (a: Actor): boolean => nerveBroken(a) && isCoweringLevel(moraleLevel(a));

/** the foes a broken actor fears on a walk to `goal`: those still in the fight who are its foes, or whom it yielded to, in
 * the zone it stands in or the one it walks to */
export function fearedFoes(state: GameState, a: Actor, goal: Located): Actor[] {
  return allActors(state).filter((x) => x !== a && countsInFight(x) && (x.zone === a.zone || x.zone === goal.zone)
    && (foe(state, x, a) || foe(state, a, x) || stance(state, a, x) === 'yielded'));
}

/** a walk that ends farther from every feared foe than where the walker stands now (where a distance can't be told, as
 * on an old map with no rectangles, it does not count against the walk) */
export function walksAway(state: GameState, a: Actor, goal: Located): boolean {
  return fearedFoes(state, a, goal).every((f) => {
    const now = distOrNull(state, a, f), then = distOrNull(state, goal, f);
    return now === null || then === null || then > now + M_EPS;
  });
}

/** whether the walker's nerve lets this walk run: always when it holds; broken, only away (walksAway); at Cowering, never */
export function nerveLetsWalk(state: GameState, a: Actor, goal: Located): boolean {
  if (!nerveBroken(a)) return true;
  return !nerveCowers(a) && walksAway(state, a, goal);
}
