// Achievement rewards beyond XP and roll bonuses (AchievementDef reward fields). Only the owner's current achievements
// count: a level replaced by a higher one of its chain stops giving its rewards.
import type { AchievementDef, Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { dayOf, now } from '../time';

type Reward = 'unawareShift' | 'quieter' | 'deathsDoor';

/** the actor's current achievements (not replaced), with their library rows */
export function currentAchievements(a: Actor): { key: string; of?: string; d: AchievementDef }[] {
  const lib = getLibrary().achievements ?? {};
  return (a.progression?.achievements ?? []).filter((x) => x.key && !x.replacedBy && lib[x.key])
    .map((x) => ({ key: x.key!, ...(x.of ? { of: x.of } : {}), d: lib[x.key!] }));
}
/** the current achievement with the best value of a reward, if any: the largest, but for deathsDoor the shortest refill */
export function bestReward(a: Actor, f: Reward): { key: string; name: string; value: number } | undefined {
  const dir = f === 'deathsDoor' ? 1 : -1;
  const best = currentAchievements(a).filter((x) => (x.d[f] ?? 0) > 0).sort((x, y) => dir * ((x.d[f] ?? 0) - (y.d[f] ?? 0)))[0];
  return best ? { key: best.key, name: best.d.name, value: best.d[f]! } : undefined;
}
/** readsHealth: the viewer sees the other's health level when it holds a current achievement with readsHealth for the
 * other's body type or race */
export function readsHealthOf(viewer: Actor | undefined, other: Actor | undefined): boolean {
  if (!viewer || !other) return false;
  return currentAchievements(viewer).some((x) => x.d.readsHealth
    && ((x.d.by === 'body_type' && x.of === other.core.bodyTypeId) || (x.d.by === 'race' && x.of === other.core.raceId)));
}
const criticalMax = () => CONFIG.HEALTH_TRACK.find(([l]) => l === 'Critical')![1];
/** deathsDoor: a hit that would take the actor from above Down to Down or worse leaves it at Critical, once per charge;
 * the charge refills after the reward's number of game days. Returns the HP lost to keep. */
export function deathsDoor(state: GameState, a: Actor, before: number, lost: number): number {
  const top = criticalMax();
  if (before > top || lost <= top) return lost;
  const r = bestReward(a, 'deathsDoor');
  const pr = a.progression;
  if (!r || !pr) return lost;
  const today = dayOf(now(state)), last = pr.charges?.[r.key];
  if (last !== undefined && today - last < r.value) return lost;
  (pr.charges ??= {})[r.key] = today;
  state.log.push({ turn: state.turn, code: 'deaths_door', detail: { actorId: a.id, achievement: r.key } });
  return top;
}
