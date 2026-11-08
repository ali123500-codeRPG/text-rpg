// Perk moves (AE5, AE8; Ali 07/11/2026; rules in src/library/perks.ts). The player names one by its perk id in the
// Parser's perkMove. A free move resolves beside the main action, before it; the others will be main actions of their
// own type (Plead, Battle Cry, Buy Them Off, later milestones).
//   Dirt in the Eyes (A9): free, once per engagement, needs a free hand; an unarmed_improvised roll against the foe's
//   dodge; unless the foe wins, its next attack or defense roll is two tiers worse (until the end of its next turn).
import type { Actor, ContestResult, Effect, GameState, Rng } from '../types';
import { PERK_MOVES, hasPerk, markUse, ruleset } from '../ruleset';
import { usableGrips } from '../ruleset/body';
import { handsOf, isHeld } from '../ruleset/gear';
import { actorById, isActive } from './relations';
import { usableThisEngagement, useThisEngagement } from './engagement';
import { markUntilNextTurn } from './perkMarks';

/** the actor has a working Grip arm with nothing held in it */
export const freeHand = (state: GameState, a: Actor) => {
  const busy = new Set(a.core.inventory.filter(isHeld).flatMap(handsOf));
  return usableGrips(state, a).some((g: string) => !busy.has(g));
};

/** why the move can't be used now, or null */
export function perkMoveBlock(state: GameState, a: Actor, perk: string, targetId: string | null): string | null {
  const def = PERK_MOVES[perk];
  if (!def || !hasPerk(a, perk)) return 'not_owned';
  const t = targetId ? actorById(state, targetId) : undefined;
  if (!t || t === a || !isActive(t) || t.zone !== a.zone) return 'no_target';
  if (def.perEngagement && a.engagement && !usableThisEngagement(a, perk, def.perEngagement)) return 'used_this_engagement';
  if (perk === 'dirt_in_the_eyes' && !freeHand(state, a)) return 'no_free_hand';
  return null;
}

/** resolves a perk move; returns the effects for its event and the roll */
export function resolvePerkMove(state: GameState, a: Actor, perk: string, targetId: string, rng: Rng): { effects: Effect[]; result?: ContestResult } {
  const t = actorById(state, targetId)!;
  // a perk move used outside an engagement starts one, so its once-per-engagement use is counted
  if (!a.engagement) a.engagement = { start: state.turn, last: state.turn, kinds: ['fight'] };
  useThisEngagement(a, perk);
  if (perk === 'dirt_in_the_eyes') {
    const req = (id: string, skill: string) => ({ actorId: id, skill, modifiers: [], tierShifts: [] });
    const c = ruleset.contested(req(a.id, 'unarmed_improvised'), req(t.id, 'dodge'), state, rng);
    markUse(state, a, c.a.skill, c);
    markUse(state, t, c.b.skill, c);
    const dodged = c.winner === 'b'; // the foe must win outright
    if (!dodged) markUntilNextTurn(state, t, 'dirt_in_the_eyes');
    return { effects: [{ kind: dodged ? 'dirt_dodged' : 'dirt_in_eyes', actorId: t.id, data: { by: a.id, perk } }], result: c };
  }
  return { effects: [] };
}
