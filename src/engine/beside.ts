// What rides beside a turn's main action (AT11, AE5/AE8, WN6 a, FR2): the one rule step() in resolve.ts spends a perk
// move's main time by, and the action deck's free mark reads (src/ui/deck.ts, SX8).
import { PERK_MOVES } from '../ruleset';
import type { Intent } from '../types';

/** the order rides beside the main action, at none of its time: it carries gear ops (done before the action), a warning
 * (a shout, WN6 a) or a perk move PERK_MOVES calls free, and no action, move or way op of its own. A perk move that is not
 * free spends its Action times row from the main time (AT11) */
export function ridesBeside(o: Partial<Pick<Intent, 'action' | 'move' | 'way' | 'gear' | 'warn' | 'perkMove'>>): boolean {
  if (o.action || o.move || o.way) return false;
  if (o.perkMove && !PERK_MOVES[o.perkMove.perk]?.free) return false;
  return !!(o.gear?.length || o.warn || o.perkMove);
}
