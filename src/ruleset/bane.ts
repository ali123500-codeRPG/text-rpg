// D-111 Bane bonuses (AGG comparison A3): an achievement earned against a race or body type ("Bane of
// {race}kind", "{body_type}bane" …) gives skill on rolls against that race or type. D-119 total-defeats achievements
// (Blooded Fighter …) add to every attack and defense roll. Both follow the chain linkage ruling (BG-256): a level's own
// step is its place in the chain times the step (CONFIG.BANE_SKILL_PER_LEVEL, CONFIG.DEFEATS_ROLL_PER_TIER), and a level
// gives its own step plus every lower level's: Bane I = +5 skill, II = +5 + 10 = +15, III = +5 + 10 + 15 = +30; total
// defeats I = +1, II = +3, III = +6, IV = +10. Lower levels switched off by a higher one are skipped. The best race one
// and the best body type one both count, as one modifier type, so the weaker counts at stackWeight(2, MOD_STACK_EXP).
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
/** the own steps of a level and every level below it, lowest first: level n's own step is n × step (BG-256) */
export const chainSteps = (key: string, step: number): number[] => Array.from({ length: chainTier(key) }, (_, i) => (i + 1) * step);
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
/** skill bonus of one achievement level: its own step (place × BANE_SKILL_PER_LEVEL) plus every lower level's */
export const baneSkill = (key: string): number => sum(chainSteps(key, CONFIG.BANE_SKILL_PER_LEVEL));

const signed = (n: number) => `+${Math.round(n * 100) / 100}`;
/** the display line of a Bane or total-defeats level's roll bonus: the total, then each level's own part, lowest first
 * ("+15 on rolls vs that body type (+2.5 + +5 + +7.5)"); null for any other achievement. Bane parts are skill steps
 * shown as roll value (× SKILL_WEIGHT), the same value baneMods adds to the roll. */
export function chainRollLine(key: string, d: AchievementDef | undefined): string | null {
  const parts = isBane(d) ? chainSteps(key, CONFIG.BANE_SKILL_PER_LEVEL).map((x) => CONFIG.SKILL_WEIGHT * x)
    : d?.rule === 'defeats' && !d.by ? chainSteps(key, CONFIG.DEFEATS_ROLL_PER_TIER) : null;
  if (!parts) return null;
  const what = isBane(d) ? `on rolls vs that ${d!.by === 'body_type' ? 'body type' : 'race'}` : 'on every attack and defense roll';
  return `${signed(sum(parts))} ${what}${parts.length > 1 ? ` (${parts.map(signed).join(' + ')})` : ''}`;
}

const COMBAT_ROLLS = new Set(['hit', 'dodge', 'block', 'parry']);
/** roll bonus of one total-defeats achievement: its own step (place × DEFEATS_ROLL_PER_TIER) plus every lower level's
 * (I = +1, II = +3, III = +6, IV = +10) */
export const defeatsRoll = (key: string): number => sum(chainSteps(key, CONFIG.DEFEATS_ROLL_PER_TIER));
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
