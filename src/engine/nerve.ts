// BF79: a broken nerve may walk or run away, never toward a foe; at Cowering (below Broken) it may not walk at all.
// One rule for every walk: the player's, an NPC's, a flee (resolve.ts walk asks it before any walk runs).
import type { Actor, GameState } from '../types';
import { isBrokenLevel, isCoweringLevel, moraleLevel } from '../ruleset/morale';
import { allActors, countsInFight, foe, isActive, stance, warm } from './relations';
import { distOrNull, M_EPS, type Located, placeOf } from './position';
import { hasPerk } from '../ruleset/perks';
import { PK } from '../library/perkIds';
import { hearsClearly } from '../perception';
import { VOLUME_NOISE } from '../perception/noise';
import { perceivesNow } from './yield';

/** broken: the bar at Broken or below, or an NPC whose break still holds (it lasts the scenario, BG-199) */
export const nerveBroken = (a: Actor): boolean => a.mind?.moraleState === 'broken' || (!a.mind?.moraleState && isBrokenLevel(moraleLevel(a)));
/** at Cowering: not even a walk away */
export const nerveCowers = (a: Actor): boolean => nerveBroken(a) && isCoweringLevel(moraleLevel(a));

/** the foes a broken actor fears on a walk: those still in the fight who are its foes, or whom it yielded to, that it
 * perceives now, wherever they stand (BG-294: never by zone) */
export function fearedFoes(state: GameState, a: Actor): Actor[] {
  return allActors(state).filter((x) => x !== a && countsInFight(x) && perceivesNow(state, a, x, 'faint')
    && (foe(state, x, a) || foe(state, a, x) || stance(state, a, x) === 'yielded'));
}

/** a walk that ends farther from every feared foe than where the walker stands now (where a distance can't be told, as
 * on an old map with no rectangles, it does not count against the walk) */
export function walksAway(state: GameState, a: Actor, goal: Located): boolean {
  return fearedFoes(state, a).every((f) => {
    const now = distOrNull(state, a, f), then = distOrNull(state, goal, f);
    return now === null || then === null || then > now + M_EPS;
  });
}

/** TC36 c Fall Back on Me: the nearest owner of the perk, up and not broken, that broken `a` is friendly to (or shares a band
 * with) and hears shout clearly; undefined when none */
export function fallBackOwner(state: GameState, a: Actor): Actor | undefined {
  const at = (x: Actor): Located => (placeOf(x));
  return allActors(state)
    .filter((o) => o !== a && isActive(o) && !nerveBroken(o) && hasPerk(o, PK.fall_back_on_me) && (o.bandId === a.bandId || warm(stance(state, a, o)))
      && hearsClearly(state, at(o), a, VOLUME_NOISE.shout))
    .map((o) => ({ o, d: distOrNull(state, a, o) ?? Infinity }))
    .sort((x, y) => x.d - y.d || x.o.id.localeCompare(y.o.id))[0]?.o;
}

/** whether the walker's nerve lets this walk run: always when it holds; broken, only away (walksAway) or, with Fall Back on
 * Me, toward its owner (TC36 c); at Cowering, never */
export function nerveLetsWalk(state: GameState, a: Actor, goal: Located): boolean {
  if (!nerveBroken(a)) return true;
  if (nerveCowers(a)) return false;
  if (walksAway(state, a, goal)) return true;
  const o = fallBackOwner(state, a);
  if (!o) return false;
  const now = distOrNull(state, a, o), then = distOrNull(state, goal, o);
  return now !== null && then !== null && then < now - M_EPS;
}
