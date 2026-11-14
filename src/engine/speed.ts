// RD7/ZP2: how fast an actor moves. One place: its race's real speeds (AB1 c), slowed by worn armor (a flat m/s, then a
// share), times a movement speed factor (1 today; a speed skill, perks, statuses and mounts multiply in here later, AB1).
import { CONFIG } from '../config';
import { actorBody, itemDef } from '../library';
import type { Actor, GameState } from '../types';
import { wornArmor } from '../ruleset/slots';

/** the movement speed factor: every speed is multiplied by it (1 until movement speed effects exist) */
export const speedFactor = (_a: Actor): number => 1;

/** the actor's walk and run speeds in m/s: race speeds, less worn armor's flat slowing, less its share, × speedFactor */
export function moveSpeed(state: GameState, a: Actor): { walk: number; run: number } {
  const base = actorBody(state, a).speed;
  const worn = wornArmor(a.core.inventory);
  const armor = worn ? itemDef(state, worn.itemId).armor : undefined;
  const slow = armor ? armor.speed ?? CONFIG.ARMOR_SPEED[armor.weight] ?? { flat: 0, pct: 0 } : { flat: 0, pct: 0 };
  const f = speedFactor(a);
  const at = (v: number) => Math.max(0, (v - slow.flat) * (1 - slow.pct)) * f;
  return { walk: at(base.walk), run: at(base.run) };
}

/** CO13/ZP2/AT19: the metres `seconds` of movement cover (default: a whole fight turn). A move slot walks; a main
 * slot spent moving (a dash: the move costs both actions) runs the rest of the turn (run − walk). */
export function slotMetres(state: GameState, a: Actor, paid: 'move' | 'main', seconds: number = CONFIG.FIGHT_TURN_S): number {
  const s = moveSpeed(state, a);
  return (paid === 'move' ? s.walk : s.run - s.walk) * seconds;
}
