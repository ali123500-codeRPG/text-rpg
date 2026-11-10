// All-XXX perks (src/library/allPerks.ts). When enough skills of a tree reach 50 true skill (CONFIG.ALL_STEP_SKILLS by the
// tree's rating: never for inferior, 3 for normal, 2 for superior, 1 for legendary), the actor
// gets the tree's passive and the parts of the skills at 50 (SKILL_PARTS, so a part follows its skill), each once built, for free (OwnedPerk source 'mastery'); a
// further skill reaching 50 adds its part. Every tree, with a bundle or without, earns the player its mastery achievements at
// 50, 100 and 150 on the same rule, from its rating's line (MASTERY_ACH: normal Adept/Master/Grandmaster, superior
// Paragon/Ascendant/Transcendent Sovereign, legendary Chosen/Incarnate/The Heavens Kneel).
// Checked at the end of every turn, so raises, perks and spawns all count.
// Also the rolls that read All-50 parts on the other side (Dodgy) or after the dice (Curiouser and Curiouser).
import { TR } from '../library/treeIds';
import type { Actor, GameState, Mod, TierShift } from '../types';
import { getLibrary } from '../library';
import { ALL_BUNDLES, SKILL_PARTS } from '../library/allPerks';
import { MASTERY_ACH } from '../library/achievementIds';
import { FUNCTION_ROLLS } from '../library/functionNames';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { grantAchievement } from '../engine/xp';
import { hasPerk, trueSkill } from './perks';
import { treeOpen } from './access';
import { allActors, atLeast, isActive } from '../engine/relations';
import { beliefStatus, updateBeliefs } from '../perception';
import { PK } from '../library/perkIds';

/** the tree's skills the actor has at `step` true skill or more (a tree it is barred from: none) */
export function skillsAt(a: Actor, treeId: string, step: number): string[] {
  const tree = getLibrary().trees[treeId];
  return tree && treeOpen(a, treeId) ? tree.skills.filter((s) => trueSkill(a, s) >= step) : [];
}

/** how many of the tree's skills at a step earn its All-XXX, by its rating; null = never (an inferior tree) */
export function allStepNeed(treeId: string): number | null {
  return CONFIG.ALL_STEP_SKILLS[getLibrary().trees[treeId]?.rating ?? 'normal'] ?? null;
}

/** the tree's All-XXX at `step` is earned: enough of its skills (allStepNeed) at `step` or more */
export function treeAt(a: Actor, treeId: string, step: number): boolean {
  const need = allStepNeed(treeId);
  return need !== null && skillsAt(a, treeId, step).length >= need;
}

export function grantAllSteps(state: GameState, a: Actor): void {
  const lib = getLibrary(), perks = lib.perks;
  if (a.id === state.player.id) for (const treeId of Object.keys(lib.trees)) // each rating has its own line (MASTERY_ACH)
    for (const [step, key] of Object.entries(MASTERY_ACH[lib.trees[treeId].rating ?? 'normal'] ?? {}))
      if (treeAt(a, treeId, Number(step))) grantAchievement(state, key, treeId); // once only (B4)
  const step = 50; // the All-50 (All-100 and All-150 are designed later, G8)
  for (const treeId of Object.keys(lib.trees)) {
    if (!treeAt(a, treeId, step)) continue;
    const at = skillsAt(a, treeId, step);
    const passive = ALL_BUNDLES.find((b) => b.treeId === treeId && b.step === step)?.passive;
    for (const id of [...(passive ? [passive] : []), ...at.flatMap((s) => (SKILL_PARTS[s] ? [SKILL_PARTS[s]] : []))]) {
      if (!perks[id]?.built || a.core.perks.some((p) => p.perkId === id)) continue;
      a.core.perks.push({ perkId: id, source: 'mastery', gainedTurn: state.turn, treeId, tier: step });
      state.log.push({ turn: state.turn, code: 'all_step_perk', detail: { actorId: a.id, perkId: id, treeId, step } });
    }
  }
}

/** modifiers a roll takes from the other side's perks (the roll's `against`): T4d Dodgy on attack rolls */
export function foeMods(foe: Actor | undefined, rollKind: string | undefined): Mod[] {
  if (rollKind === 'hit' && hasPerk(foe, PK.dodgy)) return [{ source: 'Dodgy', type: 'foe_perk', value: -CONFIG.SKILL_WEIGHT * CONFIG.DODGY_SKILL }];
  return [];
}

/** T5b Spotter: at turn end, the owner's band-mates in its zone become at least suspicious of every
 * actor the owner is aware of, so they know something is there. */
export function shareSpotted(state: GameState, o: Actor): void {
  if (!hasPerk(o, PK.spotter) || !isActive(o)) return;
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
  if (FUNCTION_ROLLS.some((f) => fns.includes(f)) && level >= TIERS.pos('success') && hasPerk(a, PK.curiouser)) return [{ source: 'Curiouser and Curiouser', value: 1 }];
  if (nearMissUp && level === TIERS.pos('near_miss')) return [{ source: nearMissUp, value: 1 }];
  // T7a Soft Landing: a speech roll at Near Miss or worse counts one tier higher
  const speech = getLibrary().trees[TR.speech]?.skills ?? [];
  if (speech.includes(skill) && level <= TIERS.pos('near_miss') && hasPerk(a, PK.soft_landing)) return [{ source: 'Soft Landing', value: 1 }];
  return [];
}
