// TC35 b Never Flat-Footed (Battle Sense 100): a foe the owner has seen this fight can never catch it unaware. Each turn's
// end notes who the owner sees (Engagement.seen); an attack by one of them is never an ambush, never makes the owner act
// last for being unaware (initiativeOrder), and never lands Ghost Blade's Hidden Strike. A sleeping or downed owner is
// still struck as unaware: the perk is about knowing where a foe is, not about being awake.
import type { Actor, GameState } from '../types';
import { PK } from '../library/perkIds';
import { hasPerk } from '../ruleset';
import { seenIds } from '../views';
import { allActors, isActive, isAsleep } from './relations';

/** at the end of each turn: the owner, in an engagement and awake, adds everyone it sees now to the engagement's list */
export function noteSeen(state: GameState): void {
  for (const a of allActors(state)) {
    const e = a.engagement;
    if (!e || !hasPerk(a, PK.never_flat_footed) || !isActive(a) || isAsleep(a)) continue;
    const seen = new Set(e.seen ?? []);
    for (const id of seenIds(state, a)) seen.add(id);
    if (seen.size) e.seen = [...seen].sort();
  }
}

/** the owner has seen the attacker this fight, so the attack can't catch it unaware */
export const neverFlatFooted = (owner: Actor, attacker: Actor): boolean =>
  hasPerk(owner, PK.never_flat_footed) && !!owner.engagement?.seen?.includes(attacker.id);
