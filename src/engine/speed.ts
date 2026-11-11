// RD7/ZP2: how fast an actor moves. One place: its body type's real speeds, slowed by worn armor (a flat m/s, then a
// share), times a movement speed factor (1 today; perks, statuses and mounts plug in here later).
import { CONFIG } from '../config';
import { DU } from '../library/tableIds';
import { actorBody, getLibrary, itemDef } from '../library';
import type { Actor, GameState } from '../types';

/** the movement speed factor: every speed is multiplied by it (1 until movement speed effects exist) */
export const speedFactor = (_a: Actor): number => 1;

/** the actor's walk and run speeds in m/s: body type speeds, less worn armor's flat slowing, less its share, × speedFactor */
export function moveSpeed(state: GameState, a: Actor): { walk: number; run: number } {
  const base = actorBody(state, a).speed;
  const worn = a.core.inventory.find((i) => i.equippedIn?.includes('armor'));
  const armor = worn ? itemDef(state, worn.itemId).armor : undefined;
  const slow = armor ? armor.speed ?? CONFIG.ARMOR_SPEED[armor.weight] ?? { flat: 0, pct: 0 } : { flat: 0, pct: 0 };
  const f = speedFactor(a);
  const at = (v: number) => Math.max(0, (v - slow.flat) * (1 - slow.pct)) * f;
  return { walk: at(base.walk), run: at(base.run) };
}

/** CO13/ZP2: the metres one slot of movement covers in a fight turn (the Fight turn duration). A move slot walks; a main
 * slot spent moving (a dash: the move costs both actions) runs the rest of the turn (run − walk). */
export function slotMetres(state: GameState, a: Actor, paid: 'move' | 'main'): number {
  const seconds = (getLibrary().durations?.[DU.fight_turn]?.minutes ?? 0.1) * 60;
  const s = moveSpeed(state, a);
  return (paid === 'move' ? s.walk : s.run - s.walk) * seconds;
}
