// A8 Hold (rules in src/library/perks.ts): a grapple that lands with a Great Success or better holds
// the target. A held actor can't leave the holder's zone or use a two-handed mode; trying to leave is its break-free
// move, a grapple contest it wins on a tie or better. The hold ends when the target breaks free, the holder is downed or
// the holder leaves the zone (relations.ts heldBy() checks the last two each time it is read).
import type { Actor, AttackResult, Effect, GameState, Rng } from '../types';
import { hasPerk, ruleset, tierAtLeast, tierLevel } from '../ruleset';
import { heldBy, isActive } from './relations';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { contestFeat } from './feats';
import { met } from '../ruleset/hits';
import { effectiveSkill } from '../ruleset/gear';

const GRAPPLE = SK.unarmed_grapple;

/** after a grapple attack: lock on if the attacker has Hold and the roll was a Great Success or better that hit */
export function applyHold(A: Actor, D: Actor, r: AttackResult, modeSkill: string): Effect | null {
  if (modeSkill !== GRAPPLE || !hasPerk(A, PK.hold) || !met(r.outcome) || !tierAtLeast(r.attack, 'great_success') || !isActive(D)) return null;
  D.heldBy = A.id;
  return { kind: 'held', actorId: D.id, data: { by: A.id } };
}

/** a held actor tries to leave: the move becomes a break-free contest (grapple against grapple, the target wins ties) */
export function breakFree(state: GameState, a: Actor, rng: Rng): { free: boolean; effect: Effect } | null {
  const h = heldBy(state, a);
  if (!h) {
    delete a.heldBy;
    return null;
  }
  const req = (id: string) => ({ actorId: id, skill: GRAPPLE, modifiers: [], tierShifts: [] });
  // All-50 Hard to Hold: the owner's break-free roll gets tier shift +1
  const mine = ruleset.roll({ ...req(a.id), tierShifts: hasPerk(a, PK.hard_to_hold) ? [{ source: 'Hard to Hold', value: 1 }] : [] }, state, rng);
  const theirs = ruleset.roll(req(h.id), state, rng);
  const free = tierLevel(mine) - tierLevel(theirs) >= 0;
  contestFeat(state, { a: mine, b: theirs, gap: tierLevel(theirs) - tierLevel(mine), winner: free ? 'a' : 'b' }); // N4c
  if (free) delete a.heldBy;
  return { free, effect: { kind: free ? 'broke_free' : 'still_held', actorId: a.id, data: { by: h.id, tier: mine.tier } } };
}

/** BF5 Restrain (run 82b): a grab that holds someone back without hurting them. The
 * restrainer's grapple against the target's better of grapple and dodge; it holds on a win (the target wins ties), with
 * no damage and no hostility. A held target's next move is its break-free try (breakFree): failing it loses that move. */
export function restrain(state: GameState, A: Actor, D: Actor, rng: Rng): { held: boolean; effect: Effect } {
  const best = [GRAPPLE, SK.dodge].reduce((b, sk) => (effectiveSkill(state, D, sk).value > effectiveSkill(state, D, b).value ? sk : b));
  const r = ruleset.contested({ actorId: A.id, skill: GRAPPLE, modifiers: [], tierShifts: [] }, { actorId: D.id, skill: best, modifiers: [], tierShifts: [] }, state, rng);
  contestFeat(state, r); // N4c
  const held = r.winner === 'a';
  if (held) D.heldBy = A.id;
  return { held, effect: { kind: held ? 'held' : 'slipped_grab', actorId: D.id, data: { by: A.id, tier: r.a.tier } } };
}

/** turn upkeep: holds that no longer stand are cleared */
export function releaseHolds(state: GameState, actors: Actor[]): void {
  for (const a of actors) if (a.heldBy && !heldBy(state, a)) delete a.heldBy;
}
