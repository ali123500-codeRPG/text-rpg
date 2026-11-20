// RD7/ZP2: how fast an actor moves. One place: its race's real speeds (AB1 c), slowed by worn armor (a flat m/s, then a
// share), times a movement speed factor (1 today; a speed skill, perks, statuses and mounts multiply in here later, AB1).
import { CONFIG } from '../config';
import { actorBody } from '../library';
import type { Actor, GameState } from '../types';
import { stackCost, wornPieces } from '../ruleset/worn';
import { timeFactor } from '../ruleset/actionTime';

/** the movement speed factor: every speed is multiplied by it. It is the inverse of the time factor, so a movement's time
 * scales like every other action's (VS8: sneaking) */
export const speedFactor = (a: Actor): number => 1 / timeFactor(a);

/** the actor's walk and run speeds in m/s: race speeds, less worn armor's flat slowing, less its share, × speedFactor */
export function moveSpeed(state: GameState, a: Actor): { walk: number; run: number } {
  const base = actorBody(state, a).speed;
  const each = wornPieces(state, a).map(({ armor }) => armor.speed ?? CONFIG.ARMOR_SPEED[armor.weight] ?? { flat: 0, pct: 0 });
  const slow = { flat: stackCost(each.map((x) => x.flat)), pct: stackCost(each.map((x) => x.pct)) }; // IR24 a: each piece, stacked
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

/** AT20/TP4: the time an actor carries into this turn, one entry per turn it was left over in, oldest first: only entries
 *  still within CARRY_TURNS count (noteCarry keeps carry only in a fight, so out of one this is empty) */
export const carriedIn = (state: GameState, a: Actor): NonNullable<Actor['carry']> =>
  (a.carry ?? []).filter((c) => state.turn - c.turn <= CONFIG.CARRY_TURNS);

/** the seconds of one pool carried into this turn */
export const carriedS = (state: GameState, a: Actor, pool: 'move' | 'main'): number => carriedIn(state, a).reduce((n, c) => n + c[pool], 0);

/** CU3 a: the metres a pool covers this fight turn, carried time included, as the engine walks it (slotsOf) */
export const turnMetres = (state: GameState, a: Actor, paid: 'move' | 'main'): number =>
  slotMetres(state, a, paid, CONFIG.FIGHT_TURN_S + carriedS(state, a, paid));
