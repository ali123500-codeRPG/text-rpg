// D-17 learning for the Tactics tree (TC6 a, TC6 b, TC15 a; D-132 closed). Only the player learns (markIfClose); TC6 c and
// TC15 b (rows and perks that fire) stay inert until NPCs learn (TC16 a, D-373).
import type { Actor, FightLog, GameState } from '../types';
import { getLibrary } from '../library';
import { FN } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { TR } from '../library/treeIds';
import { trueSkill } from '../ruleset/perks';
import { fnSkills } from '../ruleset/gear';
import { markIfClose } from '../ruleset/improve';
import { actorById, foesAfter, isActive } from './relations';
import { power } from './xp';

/** a foe untrained in the skill never teaches it (TC6 a) */
const teach = (state: GameState, skill: string, opposition: number) => { if (opposition > 0) markIfClose(state, state.player, skill, opposition); };

/** TC6 a: the reaction roll at the start of the player's fight marks Battle Sense against the best Reaction-function skill
 * among the foes in it */
export function markReaction(state: GameState, a: Actor): void {
  if (a !== state.player) return;
  const best = Math.max(0, ...foesAfter(state, a).flatMap((x) => fnSkills(FN.initiative).map((s) => trueSkill(x, s))));
  teach(state, SK.battle_sense, best);
}

/** TC6 b, TC15 a: a fight the player came through still up marks each Tactics skill once, against the strongest foe's
 * (highest power) same skill */
export function markFightSurvived(state: GameState, f: FightLog): void {
  if (!isActive(state.player)) return;
  const foes = f.foes.map((id) => actorById(state, id)).filter((x): x is Actor => !!x);
  if (!foes.length) return;
  const strongest = foes.reduce((b, x) => (power(state, x) > power(state, b) ? x : b));
  for (const skill of getLibrary().trees[TR.tactics]?.skills ?? []) teach(state, skill, trueSkill(strongest, skill));
}
