// Perk moves (AE5, AE8; rules in src/library/perks.ts). The player names one by its perk id in the
// Parser's perkMove. A free move resolves beside the main action, before it; the others will be main actions of their
// own type (Plead, Battle Cry, Buy Them Off, later milestones).
//   Battle Cry (C2, I9): the main action, once per engagement, aimed at no one; a Loud roar resolved in resolve.ts
//   doPerkMove() by battleCry() in auras.ts.
//   Dirt in the Eyes (A9): free, once per engagement, needs a free hand; an unarmed_improvised roll against the foe's
//   dodge; unless the foe wins, its next attack or defense roll is two tiers worse (until the end of its next turn).
//   Bluff (LI1c): free, once per foe per engagement; a Lying roll against the foe's answer to a lie (answerRoll, so
//   Takes One to Know One counts); unless the foe wins, it believes the lie and acts last next turn (initiativeOrder).
import type { Actor, ContestResult, Effect, GameState, Rng } from '../types';
import { PERK_MOVES, hasPerk, markUse, ruleset } from '../ruleset';
import { usableGrips } from '../ruleset/body';
import { handsOf, isHeld } from '../ruleset/gear';
import { actorById, isActive, wary } from './relations';
import { usableThisEngagement, useThisEngagement } from './engagement';
import { markUntilNextTurn } from './perkMarks';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { contestFeat } from './feats';
import { answerRoll, answerSkill, toContest } from './speech';
import { getLibrary } from '../library';
import { now } from '../time';
import { threadboundItemFor } from '../ruleset/threadboundItems';
import { hearsClearly } from '../perception';
import { sightDistM } from './position';
import { CONFIG } from '../config';
import { VOLUME_NOISE } from '../perception/noise';

/** the actor has a working Grip arm with nothing held in it */
export const freeHand = (state: GameState, a: Actor) => {
  const busy = new Set(a.core.inventory.filter(isHeld).flatMap(handsOf));
  return usableGrips(state, a).some((g: string) => !busy.has(g));
};

/** how near the target must be, by what the move is: a lie must be heard clearly at a normal voice (the speech rule);
 * Dirt in the Eyes is a throw, so it reaches as far as an improvised throw, in sight (ZR1) */
function inRange(state: GameState, a: Actor, t: Actor, perk: string): boolean {
  if (perk === PK.bluff) return hearsClearly(state, a, t, VOLUME_NOISE.normal);
  if (perk === PK.dirt_in_the_eyes) return sightDistM(state, a, t) <= CONFIG.THROW_M.improvised;
  return false;
}

/** the key a move's uses are counted under this engagement: per foe for a perFoe move */
const useKey = (perk: string, targetId: string | null) => PERK_MOVES[perk]?.perFoe ? `${perk}:${targetId}` : perk;

/** counts a use of the move; one used outside an engagement starts one, so its once-per-engagement use is counted */
export function countPerkMove(state: GameState, a: Actor, perk: string, targetId: string | null): void {
  if (!a.engagement) a.engagement = { start: state.turn, last: state.turn, kinds: ['fight'] };
  useThisEngagement(a, useKey(perk, targetId));
}

/** why the move can't be used now, or null */
export function perkMoveBlock(state: GameState, a: Actor, perk: string, targetId: string | null): string | null {
  const def = PERK_MOVES[perk];
  if (!def || !hasPerk(a, perk)) return 'not_owned';
  const arm = getLibrary().perks[perk]?.eventArm;
  if (arm) { // D-218: a Threadbound item's active ability
    const inst = threadboundItemFor(a, perk);
    if (!inst) return 'not_owned';
    if (inst.armed) return 'already_armed';
    const last = inst.usedAt?.[perk];
    return last !== undefined && now(state) - last < arm.cooldownMin ? 'cooldown' : null;
  }
  if (def.untargeted) return def.perEngagement && a.engagement && !usableThisEngagement(a, perk, def.perEngagement) ? 'used_this_engagement' : null;
  const t = targetId ? actorById(state, targetId) : undefined;
  if (!t || t === a || !isActive(t) || !inRange(state, a, t, perk)) return 'no_target';
  if (def.perEngagement && a.engagement && !usableThisEngagement(a, useKey(perk, targetId), def.perEngagement)) return 'used_this_engagement';
  if (perk === PK.dirt_in_the_eyes && !freeHand(state, a)) return 'no_free_hand';
  if (perk === PK.bluff && !wary(state, a, t) && !wary(state, t, a)) return 'not_a_foe';
  return null;
}

/** D-218: arms the owner's next event roll with a Threadbound item's active ability (checked by perkMoveBlock first) */
export function armThreadboundItem(state: GameState, a: Actor, perk: string): Effect[] {
  const inst = threadboundItemFor(a, perk)!;
  inst.armed = perk;
  (inst.usedAt ??= {})[perk] = now(state);
  return [{ kind: 'event_roll_armed', actorId: a.id, data: { perk, itemId: inst.itemId } }];
}

/** resolves a perk move; returns the effects for its event and the roll */
export function resolvePerkMove(state: GameState, a: Actor, perk: string, targetId: string, rng: Rng): { effects: Effect[]; result?: ContestResult } {
  const t = actorById(state, targetId)!;
  countPerkMove(state, a, perk, targetId);
  if (perk === PK.dirt_in_the_eyes) {
    const req = (id: string, skill: string) => ({ actorId: id, skill, modifiers: [], tierShifts: [] });
    const c = ruleset.contested(req(a.id, SK.unarmed_improvised), req(t.id, SK.dodge), state, rng);
    markUse(state, a, c.a.skill, c);
    contestFeat(state, c); // N4c
    markUse(state, t, c.b.skill, c);
    const dodged = c.winner === 'b'; // the foe must win outright
    if (!dodged) markUntilNextTurn(state, t, PK.dirt_in_the_eyes);
    return { effects: [{ kind: dodged ? 'dirt_dodged' : 'dirt_in_eyes', actorId: t.id, data: { by: a.id, perk } }], result: c };
  }
  if (perk === PK.bluff) {
    const c = toContest(ruleset.roll({ actorId: a.id, skill: SK.lying, modifiers: [], tierShifts: [], against: t.id }, state, rng), answerRoll(state, t, answerSkill('deceive'), a.id, rng));
    markUse(state, a, c.a.skill, c);
    contestFeat(state, c);
    markUse(state, t, c.b.skill, c);
    const seen = c.winner === 'b'; // the foe must win outright to see through it
    if (!seen) markUntilNextTurn(state, t, PK.bluff);
    return { effects: [{ kind: seen ? 'bluff_seen_through' : 'bluff_believed', actorId: t.id, data: { by: a.id, perk } }], result: c };
  }
  return { effects: [] };
}
