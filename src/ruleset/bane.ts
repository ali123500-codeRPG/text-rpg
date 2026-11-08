// D-111 Bane bonuses (Ali, 08/11/2026, AGG comparison A3): an achievement earned against a race or body type ("Bane of
// {race}kind", "{body_type}bane" …) gives +CONFIG.BANE_SKILL_PER_TIER skill × its tier on rolls against that race or type.
// Tier = position in REWARD_LEVELS + 1 (I = 1, II = 2, III = 3). Only the best matching achievement counts.
import type { Actor, GameState, Mod } from '../types';
import { getLibrary } from '../library';
import { CONFIG } from '../config';
import { REWARD_LEVELS } from '../scales';

export function baneMods(state: GameState, actor: Actor, againstId: string | undefined): Mod[] {
  const earned = actor.progression?.achievements;
  if (!earned?.length || !againstId) return [];
  const foe = [state.player, ...state.actors].find((a) => a.id === againstId);
  if (!foe) return [];
  const lib = getLibrary().achievements ?? {};
  let best: { tier: number; id: string } | undefined;
  for (const a of earned) {
    const d = a.key ? lib[a.key] : undefined;
    if (!d?.by || !a.of) continue;
    if (a.of !== (d.by === 'race' ? foe.core.raceId : foe.core.bodyTypeId)) continue;
    const tier = REWARD_LEVELS.pos(d.level as (typeof REWARD_LEVELS.keys)[number]) + 1;
    if (tier > 0 && (!best || tier > best.tier)) best = { tier, id: a.id };
  }
  if (!best) return [];
  const skill = CONFIG.BANE_SKILL_PER_TIER * best.tier;
  return [{ source: `bane: ${best.id}`, type: 'achievement', value: CONFIG.SKILL_WEIGHT * skill }];
}
