// All-XXX perks (src/library/allPerks.ts). When every skill of a tree reaches 50 true skill, the actor
// gets each built part of that tree's All-50 bundle for free (OwnedPerk source 'mastery'), and the player earns the
// tree's mastery achievement ("Adept of {tree}"). Checked at the end of every turn, so raises, perks and spawns all count.
// Also the rolls that read All-50 parts on the other side (Dodgy) or after the dice (Curiouser and Curiouser).
import type { Actor, GameState, Mod, TierShift } from '../types';
import { getLibrary } from '../library';
import { ALL_BUNDLES } from '../library/allPerks';
import { FUNCTION_ROLLS } from '../library/functionNames';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { grantAchievement } from '../engine/xp';
import { hasPerk, trueSkill } from './perks';
import { treeOpen } from './access';
import { allActors, atLeast, isActive } from '../engine/relations';
import { beliefStatus, updateBeliefs } from '../perception';

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

/** T5b Spotter: at turn end, the owner's band-mates in its zone become at least suspicious of every
 * actor the owner is aware of, so they know something is there. */
export function shareSpotted(state: GameState, o: Actor): void {
  if (!hasPerk(o, 'spotter') || !isActive(o)) return;
  const mates = allActors(state).filter((y) => y !== o && isActive(y) && y.zone === o.zone && !!o.bandId && y.bandId === o.bandId);
  if (!mates.length) return;
  for (const x of allActors(state)) {
    if (x === o || x.bandId === o.bandId || !isActive(x) || !atLeast(beliefStatus(state, o, x), 'aware')) continue;
    for (const y of mates) if (!atLeast(beliefStatus(state, y, x), 'suspicious')) updateBeliefs(state, { kind: 'told', observerId: y.id, aboutId: x.id, status: 'suspicious', zone: x.zone });
  }
}

/** shifts read after the dice. T5d Curiouser and Curiouser: a sight or hearing roll (by function) at Success or better counts one tier
 * higher. A request's nearMissUp (T6d Hushed Steps): a Near Miss counts one tier higher. */
export function afterRollShifts(a: Actor, skill: string, level: number, nearMissUp?: string): TierShift[] {
  const fns = getLibrary().skills[skill]?.functions ?? [];
  if (FUNCTION_ROLLS.some((f) => fns.includes(f)) && level >= TIERS.pos('success') && hasPerk(a, 'curiouser')) return [{ source: 'Curiouser and Curiouser', value: 1 }];
  if (nearMissUp && level === TIERS.pos('near_miss')) return [{ source: nearMissUp, value: 1 }];
  // T7a Soft Landing: a speech roll at Near Miss or worse counts one tier higher
  const speech = getLibrary().trees.speech?.skills ?? [];
  if (speech.includes(skill) && level <= TIERS.pos('near_miss') && hasPerk(a, 'soft_landing')) return [{ source: 'Soft Landing', value: 1 }];
  return [];
}
