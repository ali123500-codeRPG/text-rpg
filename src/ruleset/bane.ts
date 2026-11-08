// D-111 Bane bonuses (Ali, 08/11/2026, AGG comparison A3): an achievement earned against a race or body type ("Bane of
// {race}kind", "{body_type}bane" …) gives skill on rolls against that race or type. Its bonus is the bonus of the lower
// level it builds on (AchievementDef.after) plus CONFIG.BANE_SKILL_PER_LEVEL, so I = +5, II = +10, III = +15. Lower levels switched off by a higher one are skipped. The best
// race one and the best body type one both count, as one modifier type, so the weaker is halved by type stacking.
import type { Actor, GameState, Mod } from '../types';
import { getLibrary } from '../library';
import { CONFIG } from '../config';

/** skill bonus of one achievement level: +BANE_SKILL_PER_LEVEL for it and for every lower level of its chain */
export function baneSkill(key: string): number {
  const lib = getLibrary().achievements ?? {};
  let total = 0;
  for (let k: string | undefined = key, i = 0; k && lib[k] && i < 20; k = lib[k].after, i++) total += CONFIG.BANE_SKILL_PER_LEVEL;
  return total;
}

export function baneMods(state: GameState, actor: Actor, againstId: string | undefined): Mod[] {
  const earned = actor.progression?.achievements;
  if (!earned?.length || !againstId) return [];
  const foe = [state.player, ...state.actors].find((a) => a.id === againstId);
  if (!foe) return [];
  const lib = getLibrary().achievements ?? {};
  const best = new Map<string, { skill: number; id: string }>();
  for (const a of earned) {
    const d = a.key ? lib[a.key] : undefined;
    if (!d?.by || !a.of || a.replacedBy) continue;
    if (a.of !== (d.by === 'race' ? foe.core.raceId : foe.core.bodyTypeId)) continue;
    const skill = baneSkill(a.key!);
    if (skill > (best.get(d.by)?.skill ?? 0)) best.set(d.by, { skill, id: a.id });
  }
  return [...best.values()].map((b) => ({ source: `bane: ${b.id}`, type: 'achievement' as const, value: CONFIG.SKILL_WEIGHT * b.skill }));
}
