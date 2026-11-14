// BF35: how far a follow keeps from the one it follows.
import { CONFIG } from '../config';
import { usableModes } from '../ruleset/gear';
import type { Actor, GameState, MoveSpot } from '../types';

/** the longest reach of the walker's usable modes of one kind (ranged: a bow, a crossbow; melee: anything else), or null */
function reachOf(state: GameState, a: Actor, ranged: boolean): number | null {
  const r = usableModes(state, a).filter((m) => (m.mode.tree === 'ranged') === ranged).map((m) => m.mode.reach);
  return r.length ? Math.max(...r) : null;
}

/** BF35: the distance a follow keeps. Said in metres, that; at range, FOLLOW_RANGE_SHARE of the reach of the ranged weapon
 * in hand; melee, striking reach. Not said: the player keeps FOLLOW_SNEAK_M sneaking, FOLLOW_M otherwise; an NPC follows
 * at range while it holds a ranged weapon, else in melee. Closer than this the walker never backs off (walkLeg). */
export function followGap(state: GameState, a: Actor, keep: MoveSpot['keep']): number {
  const range = () => { const r = reachOf(state, a, true); return r === null ? null : r * CONFIG.FOLLOW_RANGE_SHARE; };
  const melee = () => Math.max(CONFIG.PLACE_GAP_M, reachOf(state, a, false) ?? CONFIG.PLACE_GAP_M);
  const fallback = () => (a.posture === 'stealthy' ? CONFIG.FOLLOW_SNEAK_M : CONFIG.FOLLOW_M);
  if (typeof keep === 'number') return Math.max(CONFIG.PLACE_GAP_M, keep);
  if (keep === 'range') return range() ?? fallback();
  if (keep === 'melee') return melee();
  if (a.kind !== 'player') return range() ?? melee();
  return fallback();
}
