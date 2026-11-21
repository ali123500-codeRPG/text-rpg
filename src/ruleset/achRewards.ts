// Achievement rewards beyond XP and roll bonuses (AchievementDef reward fields). Only the owner's current achievements
// count (a replaced level gives nothing itself), but a level's rewards include every reward of the lower levels of its
// chain, read from their rows, so changing a lower level changes every level above it. A level drops an inherited
// reward only by naming it in its own `excludes`.
import type { AchievementDef, AchievementReward, Actor, GameState, Mod, RollKind, TierUnlock } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { dayOf, now } from '../time';
import { skillName } from '../library/skillNames';
import { INTELLIGENCE, REWARD_LEVELS } from '../scales';
import { groupsOf } from '../library/functionNames';
import { SENSE_SKILL } from '../library/skillIds';
import { levelMaxPct } from './body';

type Reward = 'unawareShift' | 'quieter' | 'deathsDoor' | 'renown' | 'standIn' | 'reqLower' | 'pricePct' | 'rally' | 'restPct' | 'eventRoll' | 'freeLevels' | 'bonusLevels' | 'searchArea' | 'searchReach' | 'maxMorale' | 'aimEase' | 'safeBreak' | 'sellPct' | 'questPayPct' | 'essenceSlots' | 'defenseRoll' | 'spotRoll' | 'maxHpPct';
const FIELDS: AchievementReward[] = ['perk', 'unawareShift', 'quieter', 'readsHealth', 'skillAdd', 'renown', 'deathsDoor', 'firstSight', 'standIn', 'reqLower', 'pricePct', 'rally', 'restPct', 'eventRoll', 'freeLevels', 'bonusLevels', 'personality', 'personalityByKind', 'tierUnlocks', 'searchArea', 'searchReach', 'maxMorale', 'aimEase', 'safeBreak', 'skillAddByKind', 'sellPct', 'questPayPct', 'essenceSlots', 'defenseRoll', 'spotRoll', 'fearFrom', 'maxHpPct'];

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
const DEFENSE_ROLLS: RollKind[] = ['dodge', 'block', 'parry'];
/** XR7/XR37: the roll bonus of the owner's best current achievement for this roll: defense rolls take defenseRoll, spotting
 * rolls (a perception roll of sight, hearing or smell) take spotRoll. Type achievement, so it stacks with Bane and
 * total-defeats bonuses as one modifier type. */
export function achievementRollMods(a: Actor, kind: RollKind | undefined, fn?: string): Mod[] {
  const f = kind && DEFENSE_ROLLS.includes(kind) ? 'defenseRoll' : kind === 'perception' && fn && fn in SENSE_SKILL ? 'spotRoll' : undefined;
  const b = f && bestReward(a, f);
  return b ? [{ source: `achievement: ${b.name}`, type: 'achievement', value: b.value }] : [];
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
const criticalMax = () => levelMaxPct('critical');
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

/** the skills a by-kind row's kind stands for (XR2 skillAddByKind): a skill row that skill, a group row every skill of the
 * group, a function row that sense's skill (SENSE_SKILL) or else every skill with the function */
export function kindSkills(by: AchievementDef['by'], of: string): string[] {
  const skills = getLibrary().skills;
  if (by === 'skill') return [of];
  if (by === 'group') return Object.keys(skills).filter((k) => groupsOf(skills[k]).includes(of as never));
  if (by === 'function') {
    const sense = (SENSE_SKILL as Record<string, string>)[of];
    return sense ? [sense] : Object.keys(skills).filter((k) => (skills[k].functions ?? []).includes(of as never));
  }
  return [];
}
/** skillAdd and skillAddByKind: true skill the actor's current achievements add to a skill, lower levels' amounts included */
export const achievementSkill = (a: Actor, skill: string): number => currentAchievements(a).reduce((n, x) =>
  n + chainRewards(x.d).reduce((m, e) => m + (e.field === 'skillAdd' ? e.from.skillAdd?.[skill] ?? 0
    : e.field === 'skillAddByKind' && x.of && kindSkills(x.d.by, x.of).includes(skill) ? e.from.skillAddByKind! : 0), 0), 0);

/** maxMorale: the flat max morale the actor's current achievements add, lower levels' amounts included */
export const achievementMaxMorale = (a: Actor): number => currentAchievements(a).reduce((n, x) => n + rewardOf(x.d, 'maxMorale'), 0);

/** aimEase (TM26): the share (0-1) taken off the aim penalty for a part of `size`: the actor's current by-size row for that
 * size plus its current row of the trunk (any size, XR9), lower levels' amounts included */
export const achievementAimEase = (a: Actor, size: string): number =>
  Math.min(100, (bestReward(a, 'aimEase', (x) => x.d.by === 'size' && x.of === size)?.value ?? 0) + (bestReward(a, 'aimEase', (x) => !x.d.by)?.value ?? 0)) / 100;

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

/** renown (MB24): every morale roll of a foe fighting the player takes off the player's renown, every chain's added (DI22 a) */
export function renownMods(state: GameState, foe: Actor, fightingPlayer: boolean): Mod[] {
  const r = fightingPlayer ? achievementSum(state.player, 'renown') : 0;
  return r ? [{ source: `renown: ${achievementSumNames(state.player, 'renown')}`, type: 'achievement', value: -r }] : [];
}

/** a tier unlock as a reward line */
export function tierUnlockLine(u: TierUnlock): string {
  const rolls = u.roll === 'any' ? 'all your rolls' : u.roll === 'event' ? 'your event rolls' : u.roll === 'contest' ? 'your contest rolls' : `your ${u.roll} rolls`;
  return u.side === 'up' ? `${rolls} can go +${u.steps} tier${u.steps === 1 ? '' : 's'} past Critical Success`
    : `${rolls} can fall +${u.steps} tier${u.steps === 1 ? '' : 's'} below Critical Failure`;
}
/** how many tiers past Critical Success (up) and below Critical Failure (down) the actor has opened on one kind of roll:
 * every current achievement's tierUnlocks along its chain, plus every active owned perk's, for that kind or 'any' (a
 * skill roll with no roll kind reads only 'any'); a roll made in a contest also reads 'contest' (D-292) */
export function tierReach(a: Actor, roll: RollKind | undefined, contest = false): { up: number; down: number } {
  const perks = getLibrary().perks ?? {};
  const all: TierUnlock[] = [
    ...currentAchievements(a).flatMap((x) => chainRewards(x.d).filter((e) => e.field === 'tierUnlocks').flatMap((e) => e.from.tierUnlocks ?? [])),
    ...a.core.perks.filter((p) => !p.dormant).flatMap((p) => perks[p.perkId]?.tierUnlocks ?? []),
  ].filter((u) => u.roll === 'any' || (roll !== undefined && u.roll === roll) || (contest && u.roll === 'contest'));
  const sum = (side: TierUnlock['side']) => all.filter((u) => u.side === side).reduce((n, u) => n + u.steps, 0);
  return { up: sum('up'), down: sum('down') };
}
/** DI22 a: a number reward that adds up over every current achievement (each along its chain), not only the best chain:
 * renown, rest healing, quest pay, event roll and max HP % */
export function achievementSum(a: Actor, f: 'renown' | 'restPct' | 'questPayPct' | 'eventRoll' | 'maxHpPct'): number {
  return currentAchievements(a).reduce((n, x) => n + rewardOf(x.d, f), 0);
}
/** the names of the current achievements that give some of an achievementSum reward, for a modifier's source */
export const achievementSumNames = (a: Actor, f: Parameters<typeof achievementSum>[1]): string =>
  currentAchievements(a).filter((x) => rewardOf(x.d, f)).map((x) => x.d.name).join(', ');
/** a reward that adds up over every source: every current achievement's along its chain, plus every active owned perk's.
 * Free levels are level-ups that cost no XP (into a class); bonus levels are character levels no class gets; searchArea
 * and searchReach widen a search (SE24). */
export function rewardSum(a: Actor, f: SummedReward): number {
  return rewardSources(a, f).reduce((n, x) => n + x.value, 0);
}
type SummedReward = 'freeLevels' | 'bonusLevels' | 'searchArea' | 'searchReach' | 'essenceSlots';
/** rewardSum's terms, one per achievement or perk that gives any (the balance probe shows them) */
export function rewardSources(a: Actor, f: SummedReward): { source: string; value: number }[] {
  const perks = getLibrary().perks ?? {};
  return [
    ...currentAchievements(a).map((x) => ({ source: `achievement ${x.d.name}`, value: rewardOf(x.d, f) })),
    ...a.core.perks.filter((p) => !p.dormant).map((p) => ({ source: `perk ${perks[p.perkId]?.name ?? p.perkId}`, value: (perks[p.perkId] as Partial<Record<SummedReward, number>> | undefined)?.[f] ?? 0 })),
  ].filter((x) => x.value);
}
export const freeLevelsEarned = (a: Actor) => rewardSum(a, 'freeLevels');
/** free levels earned and not yet taken: halves add up over every source first, and only whole levels are given */
export const freeLevelsOwed = (a: Actor) => Math.max(0, Math.floor(rewardSum(a, 'freeLevels')) - (a.progression?.freeLevelsTaken ?? 0));
/** bonus levels earned and not yet taken */
export const bonusLevelsOwed = (a: Actor) => Math.max(0, rewardSum(a, 'bonusLevels') - (a.progression?.bonusLevelsTaken ?? 0));

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
    case 'maxMorale': return [`+${d.maxMorale} max morale`];
    case 'aimEase': return [`${d.aimEase}% less aim penalty on parts of that size`];
    case 'skillAddByKind': return [`+${d.skillAddByKind} true skill in ${d.by === 'group' ? 'every skill of that group' : d.by === 'function' ? 'that sense\'s skill' : 'that skill'}`];
    case 'sellPct': return [`traders pay you +${d.sellPct}% for what you sell`];
    case 'questPayPct': return [`+${d.questPayPct}% on the coin a quest giver promises you`];
    case 'maxHpPct': return [`+${d.maxHpPct}% max HP`];
    case 'defenseRoll': return [`+${d.defenseRoll} on your defense rolls (dodge, block, parry)`];
    case 'spotRoll': return [`+${d.spotRoll} on your spotting rolls (sight, hearing, smell)`];
    case 'fearFrom': { const f = getLibrary().fears?.[d.fearFrom!.fear];
      return [`the fear "${f?.name ?? d.fearFrom!.fear}" starts ${steps(d.fearFrom!.steps, 'health level')} later`]; }
    case 'essenceSlots': return [`+${d.essenceSlots} essence slot${d.essenceSlots === 1 ? '' : 's'}`];
    case 'safeBreak': return [`forcing a container open breaks less: every fragility line ${steps(d.safeBreak!, 'tier')} worse`];
    case 'firstSight': {
      const who = INTELLIGENCE.keys.slice(0, INTELLIGENCE.pos(d.firstSight!) + 1).map((x) => INTELLIGENCE.name(x).toLowerCase()).join(' and ');
      return [`${who} members of that ${(d.by ?? 'kind').replace('_', ' ')} meet you wary (opposed), not hostile`];
    }
    case 'standIn': return [`stand-ins on rolls of a ${d.by === 'group' ? 'skill of that group' : 'skill'} count +${d.standIn} share`];
    case 'reqLower': return [`equip requirements on that tree's skills ask ${d.reqLower} less of you (the gear's own numbers stay)`];
    case 'pricePct': return [`+${d.pricePct}% off what you pay traders`];
    case 'rally': return [`allies fighting beside you get +${d.rally} on their morale rolls`];
    case 'restPct': return [`+${d.restPct}% healing on each rest`];
    case 'eventRoll': return [`+${d.eventRoll} on your event rolls`];
    case 'tierUnlocks': return (d.tierUnlocks ?? []).map((u) => tierUnlockLine(u));
    case 'freeLevels': return [`+${steps(d.freeLevels!, 'free level')} (levels that cost no XP)`];
    case 'bonusLevels': return [`+${steps(d.bonusLevels!, 'bonus level')} (character levels no class gets: perk points, no class perks)`];
    case 'searchArea': return [`+${d.searchArea}% on your search area`];
    case 'searchReach': return [`+${d.searchReach! * CONFIG.SEARCH_M2_PER_REACH_M} m² of search area`];
    case 'perk': return [`grants the perk ${getLibrary().perks?.[d.perk!]?.name ?? d.perk}`];
    case 'personality': return personalityLines(d.personality);
    case 'personalityByKind': return Object.entries(d.personalityByKind ?? {}).flatMap(([kind, add]) => personalityLines(add).map((l) => `${l} when earned with ${kindLabel(d, kind)}`));
  }
}
/** personality points as display lines: +5 Honesty, −5 Nerve (toward Cautious) */
function personalityLines(add?: Record<string, number>): string[] {
  return Object.entries(add ?? {}).map(([k, n]) => `${n > 0 ? '+' : ''}${n} ${k === 'nerve' ? `Nerve (toward ${n > 0 ? 'Daring' : 'Cautious'})` : getLibrary().personalityAxes?.[k]?.name ?? k}`);
}
/** a by-kind row's kind in words (a skill's name for by-skill rows) */
const kindLabel = (d: AchievementDef, kind: string): string => (d.by === 'skill' ? skillName(kind) : kind);
/** number rewards that add up along a chain: shown as one total with its parts (BG-256) */
const SUMMED: Reward[] = ['unawareShift', 'quieter', 'renown', 'standIn', 'reqLower', 'pricePct', 'rally', 'restPct', 'eventRoll', 'freeLevels', 'bonusLevels',
  'searchArea', 'searchReach', 'maxMorale', 'aimEase', 'safeBreak', 'sellPct', 'questPayPct', 'essenceSlots', 'defenseRoll', 'spotRoll', 'maxHpPct'];
const SUMMED_BY_KIND: AchievementReward[] = ['skillAddByKind'];
/** the rewards of one achievement row beyond XP and roll bonuses, as plain lines for display. A number reward the row
 * carries up from lower levels (chain linkage) shows as one total, then its parts: "+15 max morale in all (+5 from
 * Hands Still Shaking, +5 from Fear Rides With Me, +5 here)"; true skill adds up per skill the same way. Other rewards
 * carried up name the level they come from. */
export function rewardLines(d: AchievementDef): string[] {
  const all = chainRewards(d);
  const part = (from: AchievementDef, v: number) => `${v > 0 ? '+' : ''}${v} ${from === d ? 'here' : `from ${from.name}`}`;
  const totalLine = (field: AchievementReward, es: { from: AchievementDef; v: number }[], make: (v: number) => AchievementDef): string[] => {
    const t = es.reduce((n, e) => n + e.v, 0);
    const ls = linesOf(make(t), field);
    return es.length < 2 ? ls.map((l) => (es[0].from === d ? l : `${l} (from ${es[0].from.name})`))
      : ls.map((l) => `${l} in all (${es.map((e) => part(e.from, e.v)).join(', ')})`);
  };
  const out: string[] = [], done = new Set<string>();
  for (const e of all) {
    if ((SUMMED as string[]).includes(e.field) || SUMMED_BY_KIND.includes(e.field)) {
      if (done.has(e.field)) continue;
      done.add(e.field);
      const f = e.field as Reward | 'skillAddByKind';
      const es = all.filter((x) => x.field === f).map((x) => ({ from: x.from, v: x.from[f] as number }));
      out.push(...totalLine(f, es, (v) => ({ ...d, [f]: v })));
    } else if (e.field === 'skillAdd') {
      if (done.has('skillAdd')) continue;
      done.add('skillAdd');
      const es = all.filter((x) => x.field === 'skillAdd');
      const skills = [...new Set(es.flatMap((x) => Object.keys(x.from.skillAdd ?? {})))];
      for (const sk of skills) out.push(...totalLine('skillAdd', es.filter((x) => x.from.skillAdd?.[sk] !== undefined).map((x) => ({ from: x.from, v: x.from.skillAdd![sk] })), (v) => ({ ...d, skillAdd: { [sk]: v } })));
    } else out.push(...linesOf(e.from, e.field).map((l) => e.from === d ? l : `${l} (from ${e.from.name})`));
  }
  return out;
}

/** Reward levels are the rows of REWARD_LEVELS (−2 to XV); a level past the top stays at the top. These helpers are the
 * one way to read a reward level's position, name and XP. */
const TOP = () => REWARD_LEVELS.keys.length - 1;
export const rewardPos = (key: string): number => (REWARD_LEVELS.has(key) ? REWARD_LEVELS.pos(key as 'i') : -1);
export const rewardKeyAt = (pos: number): string => REWARD_LEVELS.at(Math.min(TOP(), Math.max(0, pos)));
export const rewardName = (key: string): string => (REWARD_LEVELS.has(key) ? REWARD_LEVELS.name(key as 'i') : key);
/** the XP of the reward level at place p (0 = level 0, I = 1, −1 = −1): the one reward-XP equation. A fixed part
 * (REWARD_XP_CURVE) plus a share of `need`, the earner's XP to the next level (ACH_LEVEL_SHARE, AL1-AL8); need 0 = the fixed part */
export function rewardXpAt(p: number, need = 0): number {
  const c = CONFIG.REWARD_XP_CURVE, s = CONFIG.ACH_LEVEL_SHARE;
  return Math.round(c.base * Math.max(0, (p + c.shift) / c.div) ** c.power + (s.floor + (s.atI - s.floor) * Math.max(0, p) ** s.power) * need);
}
/** a reward level's XP, for achievements and quests alike (quest levels are REWARD_LEVELS keys too) */
export const rewardXp = (key: string, need = 0): number => (REWARD_LEVELS.has(key) ? rewardXpAt(REWARD_LEVELS.pos(key as 'i') - REWARD_LEVELS.pos('zero'), need) : 0);
/** the achievement reward level whose XP a quest of this level pays: CONFIG.QUEST_XP_LEVELS_UP places higher */
export const questXpLevel = (key: string): string => rewardKeyAt(rewardPos(key) + CONFIG.QUEST_XP_LEVELS_UP);
/** a quest reward level's XP: the XP of its achievement level (questXpLevel), share of `need` included */
export const questLevelXp = (key: string, need = 0): number => rewardXp(questXpLevel(key), need);

/** an achievement's reward level for one earning: its row's level, + levelUp for that kind, + levelStep for each `every`
 * step past its first count (an every-N row climbs as it is earned again), capped at the top level (XV). */
export function achLevel(d: { level: string; levelUp?: Partial<Record<string, number>>; count?: number; every?: number; levelStep?: number }, of?: string): string {
  const steps = d.every && d.levelStep && of && Number.isFinite(+of) ? Math.max(0, Math.floor((+of - (d.count ?? d.every)) / d.every)) * d.levelStep : 0;
  const up = ((of && d.levelUp?.[of]) || 0) + steps;
  return up && rewardPos(d.level) >= 0 ? rewardKeyAt(rewardPos(d.level) + up) : d.level;
}

/** the XP an achievement pays: its reward level's XP; a scar pays the place one step below (below the lowest: no fixed part,
 * only the share). need: the earner's XP to the next level (0 = the fixed part only, as the library and report card read it) */
export function achXp(d: { level: string; levelUp?: Partial<Record<string, number>>; count?: number; every?: number; levelStep?: number; scar?: true }, of?: string, need = 0): number {
  const lv = achLevel(d, of);
  return REWARD_LEVELS.has(lv) ? rewardXpAt(rewardPos(lv) - rewardPos('zero') - (d.scar ? 1 : 0), need) : 0;
}
