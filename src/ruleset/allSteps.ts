// All-XXX perks (Ali, 08/11/2026; src/library/allPerks.ts). When every skill of a tree reaches 50 true skill, the actor
// gets each built part of that tree's All-50 bundle for free (OwnedPerk source 'mastery'), and the player earns the
// tree's mastery achievement ("Adept of {tree}"). Checked at the end of every turn, so raises, perks and spawns all count.
// Also the rolls that read All-50 parts on the other side (Dodgy) or after the dice (Curiouser and Curiouser).
import type { Actor, GameState, Mod, TierShift } from '../types';
import { getLibrary } from '../library';
import { ALL_BUNDLES } from '../library/allPerks';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { grantAchievement } from '../engine/xp';
import { hasPerk, trueSkill } from './perks';
import { treeOpen } from './access';

/** every skill of the tree at `step` true skill or more */
export function treeAt(a: Actor, treeId: string, step: number): boolean {
  const tree = getLibrary().trees[treeId];
  return !!tree && treeOpen(a, treeId) && tree.skills.every((s) => trueSkill(a, s) >= step);
}

export function grantAllSteps(state: GameState, a: Actor): void {
  const perks = getLibrary().perks;
  for (const b of ALL_BUNDLES) {
    if (!treeAt(a, b.treeId, b.step)) continue;
    if (a.id === state.player.id) grantAchievement(state, `mastery_${b.step}`, b.treeId); // once only (B4)
    for (const id of b.parts) {
      if (!perks[id]?.built || a.core.perks.some((p) => p.perkId === id)) continue;
      a.core.perks.push({ perkId: id, source: 'mastery', gainedTurn: state.turn, treeId: b.treeId, tier: b.step });
      state.log.push({ turn: state.turn, code: 'all_step_perk', detail: { actorId: a.id, perkId: id, treeId: b.treeId, step: b.step } });
    }
  }
}

/** modifiers a roll takes from the other side's perks (the roll's `against`): T4d Dodgy on attack rolls */
export function foeMods(foe: Actor | undefined, rollKind: string | undefined): Mod[] {
  if (rollKind === 'hit' && hasPerk(foe, 'dodgy')) return [{ source: 'Dodgy', type: 'foe_perk', value: -CONFIG.SKILL_WEIGHT * CONFIG.DODGY_SKILL }];
  return [];
}

/** shifts read after the dice. T5d Curiouser and Curiouser: an Eyesight or Earshot roll at Success or better counts one tier
 * higher. A request's nearMissUp (T6d Hushed Steps): a Near Miss counts one tier higher. */
export function afterRollShifts(a: Actor, skill: string, level: number, nearMissUp?: string): TierShift[] {
  const senses = getLibrary().trees.perception?.skills ?? [];
  if (senses.includes(skill) && level >= TIERS.pos('success') && hasPerk(a, 'curiouser')) return [{ source: 'Curiouser and Curiouser', value: 1 }];
  if (nearMissUp && level === TIERS.pos('near_miss')) return [{ source: nearMissUp, value: 1 }];
  return [];
}
