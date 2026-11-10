// Achievement rewards beyond XP and roll bonuses (AchievementDef reward fields). Only the owner's current achievements
// count (a replaced level gives nothing itself), but a level's rewards include every reward of the lower levels of its
// chain, read from their rows, so changing a lower level changes every level above it. A level drops an inherited
// reward only by naming it in its own `excludes`.
import type { AchievementDef, AchievementReward, Actor, GameState, Mod } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { dayOf, now } from '../time';
import { skillName } from '../library/skillNames';
import { INTELLIGENCE, REWARD_LEVELS } from '../scales';
import { groupsOf } from '../library/functionNames';

type Reward = 'unawareShift' | 'quieter' | 'deathsDoor' | 'renown' | 'standIn' | 'reqLower' | 'pricePct' | 'rally' | 'restPct' | 'situation' | 'freeLevels' | 'bonusLevels';
const FIELDS: AchievementReward[] = ['perk', 'unawareShift', 'quieter', 'readsHealth', 'skillAdd', 'renown', 'deathsDoor', 'firstSight', 'standIn', 'reqLower', 'pricePct', 'rally', 'restPct', 'situation', 'freeLevels', 'bonusLevels'];

/** the actor's current achievements (not replaced), with their library rows */
export function currentAchievements(a: Actor): { key: string; of?: string; d: AchievementDef }[] {
  const lib = getLibrary().achievements ?? {};
  return (a.progression?.achievements ?? []).filter((x) => x.key && !x.replacedBy && lib[x.key])
    .map((x) => ({ key: x.key!, ...(x.of ? { of: x.of } : {}), d: lib[x.key!] }));
}
/** a row's chain from its lowest level up to itself, following `after` */
function chainOf(d: AchievementDef): AchievementDef[] {
  const lib = getLibrary().achievements ?? {};
  const out = [d];
  for (let x = d; x.after && lib[x.after] && !out.includes(lib[x.after]);) out.unshift(x = lib[x.after]);
  return out;
}
/** every reward a row gives, each with the row it is written on: its own, plus the lower levels' unless excluded */
export function chainRewards(d: AchievementDef): { field: AchievementReward; from: AchievementDef }[] {
  let acc: { field: AchievementReward; from: AchievementDef }[] = [];
  for (const r of chainOf(d)) {
    acc = acc.filter((e) => !r.excludes?.includes(e.field));
    for (const field of FIELDS) if (r[field] !== undefined) acc.push({ field, from: r });
  }
  return acc;
}
/** a row's total of one number reward along its chain: amounts add up, but for deathsDoor the shortest refill counts */
export function rewardOf(d: AchievementDef, f: Reward): number {
  const vs = chainRewards(d).filter((e) => e.field === f).map((e) => e.from[f]!);
  return !vs.length ? 0 : f === 'deathsDoor' ? Math.min(...vs) : vs.reduce((n, v) => n + v, 0);
}
/** the current achievement with the best value of a reward, if any: the largest, but for deathsDoor the shortest refill */
export function bestReward(a: Actor, f: Reward, only: (x: { key: string; of?: string; d: AchievementDef }) => boolean = () => true): { key: string; name: string; value: number } | undefined {
  const dir = f === 'deathsDoor' ? 1 : -1;
  const best = currentAchievements(a).filter(only).map((x) => ({ ...x, v: rewardOf(x.d, f) })).filter((x) => x.v > 0).sort((x, y) => dir * (x.v - y.v))[0];
  return best ? { key: best.key, name: best.d.name, value: best.v } : undefined;
}
/** readsHealth: the viewer sees the other's health level when it holds a current achievement with readsHealth for the
 * other's body type or race */
export function readsHealthOf(viewer: Actor | undefined, other: Actor | undefined): boolean {
  if (!viewer || !other) return false;
  return currentAchievements(viewer).some((x) => chainRewards(x.d).some((e) => e.field === 'readsHealth')
    && ((x.d.by === 'body_type' && x.of === other.core.bodyTypeId) || (x.d.by === 'race' && x.of === other.core.raceId)));
}
/** the achievement of `holder` whose firstSight covers `foe` (its race or body type, and the foe's race intelligence at
 * or below the reward's), if any: that foe meets the holder opposed instead of hostile */
export function firstSightOf(holder: Actor | undefined, foe: Actor): string | undefined {
  if (!holder?.progression?.achievements?.length) return undefined;
  const mind = foe.core.raceId ? getLibrary().races?.[foe.core.raceId]?.intelligence : undefined;
  if (!mind) return undefined;
  return currentAchievements(holder).find((x) => ((x.d.by === 'body_type' && x.of === foe.core.bodyTypeId) || (x.d.by === 'race' && x.of === foe.core.raceId))
    && chainRewards(x.d).some((e) => e.field === 'firstSight' && INTELLIGENCE.pos(mind) <= INTELLIGENCE.pos(e.from.firstSight!)))?.key;
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

/** skillAdd: true skill the actor's current achievements add to a skill, lower levels' amounts included */
export const achievementSkill = (a: Actor, skill: string): number => currentAchievements(a).reduce((n, x) =>
  n + chainRewards(x.d).reduce((m, e) => m + (e.field === 'skillAdd' ? e.from.skillAdd?.[skill] ?? 0 : 0), 0), 0);

/** standIn: the share stand-ins gain on rolls of `skill`, from achievements earned for a group the skill is in */
export function achievementStandIn(a: Actor, skill: string): number {
  const groups: string[] = groupsOf(getLibrary().skills[skill]);
  return bestReward(a, 'standIn', (x) => x.d.by === 'group' && !!x.of && groups.includes(x.of))?.value ?? 0;
}
/** reqLower: how much less an equip requirement on `skill` asks of the actor, from achievements earned for a tree holding it */
export function achievementReqLower(a: Actor, skill: string): number {
  const trees = getLibrary().trees ?? {};
  return bestReward(a, 'reqLower', (x) => !!x.of && !!trees[x.of]?.skills.includes(skill as never))?.value ?? 0;
}
/** rally: an ally of the player fighting beside them gets the player's best rally on its morale rolls */
export function rallyMods(state: GameState, ally: Actor, besidePlayer: boolean): Mod[] {
  const r = besidePlayer ? bestReward(state.player, 'rally') : undefined;
  return r ? [{ source: `rally: ${r.name}`, type: 'achievement', value: r.value }] : [];
}

/** renown (MB24): every morale roll of a foe fighting the player takes off the player's best renown */
export function renownMods(state: GameState, foe: Actor, fightingPlayer: boolean): Mod[] {
  const r = fightingPlayer ? bestReward(state.player, 'renown') : undefined;
  return r ? [{ source: `renown: ${r.name}`, type: 'achievement', value: -r.value }] : [];
}

/** free or bonus levels earned: every current achievement's along its chain, plus every active owned perk's.
 * Free levels are level-ups that cost no XP (into a class); bonus levels are character levels no class gets. */
export function levelsEarned(a: Actor, f: 'freeLevels' | 'bonusLevels'): number {
  const perks = getLibrary().perks ?? {};
  return currentAchievements(a).reduce((n, x) => n + rewardOf(x.d, f), 0)
    + a.core.perks.filter((p) => !p.dormant).reduce((n, p) => n + (perks[p.perkId]?.[f] ?? 0), 0);
}
export const freeLevelsEarned = (a: Actor) => levelsEarned(a, 'freeLevels');
/** free levels earned and not yet taken */
export const freeLevelsOwed = (a: Actor) => Math.max(0, levelsEarned(a, 'freeLevels') - (a.progression?.freeLevelsTaken ?? 0));
/** bonus levels earned and not yet taken */
export const bonusLevelsOwed = (a: Actor) => Math.max(0, levelsEarned(a, 'bonusLevels') - (a.progression?.bonusLevelsTaken ?? 0));

/** the display lines of one reward written on a row */
function linesOf(d: AchievementDef, f: AchievementReward): string[] {
  const steps = (n: number, what: string) => `${n} ${what}${n === 1 ? '' : 's'}`;
  switch (f) {
    case 'unawareShift': return [`+${steps(d.unawareShift!, 'tier')} on attacks against a target unaware of you`];
    case 'quieter': return [`your moves are ${steps(d.quieter!, 'step')} quieter`];
    case 'deathsDoor': return [`once every ${d.deathsDoor === 1 ? 'game day' : steps(d.deathsDoor!, 'game day')}, a hit that would take you Down leaves you at Critical`];
    case 'readsHealth': return [`you see the health level of every member of that ${(d.by ?? 'kind').replace('_', ' ')}`];
    case 'skillAdd': return Object.entries(d.skillAdd ?? {}).map(([sk, n]) => `+${n} true skill in ${skillName(sk)}`);
    case 'renown': return [`every foe fighting you takes ${-d.renown!} on its morale rolls`];
    case 'firstSight': {
      const who = INTELLIGENCE.keys.slice(0, INTELLIGENCE.pos(d.firstSight!) + 1).map((x) => INTELLIGENCE.name(x).toLowerCase()).join(' and ');
      return [`${who} members of that ${(d.by ?? 'kind').replace('_', ' ')} meet you wary (opposed), not hostile`];
    }
    case 'standIn': return [`stand-ins on rolls of a ${d.by === 'group' ? 'skill of that group' : 'skill'} count +${d.standIn} share`];
    case 'reqLower': return [`equip requirements on that tree's skills ask ${d.reqLower} less of you (the gear's own numbers stay)`];
    case 'pricePct': return [`+${d.pricePct}% off what you pay traders`];
    case 'rally': return [`allies fighting beside you get +${d.rally} on their morale rolls`];
    case 'restPct': return [`+${d.restPct}% healing on each rest`];
    case 'situation': return [`+${d.situation} on your situation rolls`];
    case 'freeLevels': return [`+${steps(d.freeLevels!, 'free level')} (levels that cost no XP)`];
    case 'bonusLevels': return [`+${steps(d.bonusLevels!, 'bonus level')} (character levels no class gets: perk points, no class perks)`];
    case 'perk': return [`grants the perk ${getLibrary().perks?.[d.perk!]?.name ?? d.perk}`];
  }
}
/** the rewards of one achievement row beyond XP and roll bonuses, as plain lines for display; a reward carried up from
 * a lower level names that level */
export function rewardLines(d: AchievementDef): string[] {
  return chainRewards(d).flatMap((e) => linesOf(e.from, e.field).map((l) => e.from === d ? l : `${l} (from ${e.from.name})`));
}

/** the reward level an achievement pays for `of`: its own level, raised by levelUp for that kind (capped at the top) */
export function achLevel(d: { level: string; levelUp?: Partial<Record<string, number>> }, of?: string): string {
  const up = (of && d.levelUp?.[of]) || 0;
  return up && REWARD_LEVELS.has(d.level) ? REWARD_LEVELS.at(Math.min(REWARD_LEVELS.keys.length - 1, REWARD_LEVELS.pos(d.level as 'i') + up)) : d.level;
}

/** the XP an achievement pays: its reward level's XP; a scar pays the level one step below (below 0: SCAR_XP_BELOW_ZERO) */
export function achXp(d: { level: string; levelUp?: Partial<Record<string, number>>; scar?: true }, of?: string): number {
  const lv = achLevel(d, of);
  if (!d.scar) return CONFIG.REWARD_XP[lv] ?? 0;
  const i = REWARD_LEVELS.has(lv) ? REWARD_LEVELS.pos(lv) : -1;
  return i > 0 ? CONFIG.REWARD_XP[REWARD_LEVELS.at(i - 1)] ?? 0 : CONFIG.SCAR_XP_BELOW_ZERO;
}
