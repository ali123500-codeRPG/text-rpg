// D-111 Bane bonuses (AGG comparison A3): an achievement earned against a race or body type ("Bane of
// {race}kind", "{body_type}bane" …) gives skill on rolls against that race or type. Its bonus is the bonus of the lower
// level it builds on (AchievementDef.after) plus CONFIG.BANE_SKILL_PER_LEVEL, so I = +5, II = +10, III = +15. Lower levels switched off by a higher one are skipped. The best
// race one and the best body type one both count, as one modifier type, so the weaker is halved by type stacking.
// D-119 total-defeats achievements (Blooded Fighter …) add +1 per tier to every attack and defense roll, as the same modifier type.
import { achievementName } from '../engine/xp';
import type { AchievementDef, Actor, GameState, Mod } from '../types';
import { getLibrary } from '../library';
import { CONFIG } from '../config';

/** an achievement's tier: 1 for it plus 1 for every lower level of its chain (AchievementDef.after) */
export function chainTier(key: string): number {
  const lib = getLibrary().achievements ?? {};
  let n = 0;
  for (let k: string | undefined = key; k && lib[k] && n < 20; k = lib[k].after) n++;
  return n;
}
/** a Bane: a defeats chain counted per race or per body type. Other per-group or per-class chains are not Banes. */
export const isBane = (d: AchievementDef | undefined): boolean => d?.rule === 'defeats' && (d.by === 'race' || d.by === 'body_type');
/** skill bonus of one achievement level: +BANE_SKILL_PER_LEVEL for it and for every lower level of its chain */
export const baneSkill = (key: string): number => chainTier(key) * CONFIG.BANE_SKILL_PER_LEVEL;

const COMBAT_ROLLS = new Set(['hit', 'dodge', 'block', 'parry']);
/** roll bonus of one total-defeats achievement: +DEFEATS_ROLL_PER_TIER for each tier (I = +1, II = +2, III = +3, IV = +4) */
export const defeatsRoll = (key: string): number => chainTier(key) * CONFIG.DEFEATS_ROLL_PER_TIER;
/** total-defeats achievements (defeats with no `by`): the highest earned one adds its roll bonus to every attack and defense roll */
export function defeatsMods(actor: Actor, rollKind: string | undefined): Mod[] {
  if (!rollKind || !COMBAT_ROLLS.has(rollKind)) return [];
  const lib = getLibrary().achievements ?? {};
  const best = (actor.progression?.achievements ?? []).filter((x) => x.key && !x.replacedBy && lib[x.key]?.rule === 'defeats' && !lib[x.key].by)
    .sort((x, y) => defeatsRoll(y.key!) - defeatsRoll(x.key!))[0];
  return best ? [{ source: `achievement: ${lib[best.key!]?.name ?? best.id}`, type: 'achievement', value: defeatsRoll(best.key!) }] : [];
}

export function baneMods(state: GameState, actor: Actor, againstId: string | undefined): Mod[] {
  const earned = actor.progression?.achievements;
  if (!earned?.length || !againstId) return [];
  const foe = [state.player, ...state.actors].find((a) => a.id === againstId);
  if (!foe) return [];
  const lib = getLibrary().achievements ?? {};
  const best = new Map<string, { skill: number; rec: { id: string; key?: string; of?: string } }>();
  for (const a of earned) {
    const d = a.key ? lib[a.key] : undefined;
    if (!d || !isBane(d) || !a.of || a.replacedBy) continue;
    if (a.of !== (d.by === 'race' ? foe.core.raceId : foe.core.bodyTypeId)) continue;
    const skill = baneSkill(a.key!);
    if (skill > (best.get(d.by!)?.skill ?? 0)) best.set(d.by!, { skill, rec: a });
  }
  return [...best.values()].map((b) => ({ source: `bane: ${achievementName(state, b.rec)}`, type: 'achievement' as const, value: CONFIG.SKILL_WEIGHT * b.skill }));
}
