// PG6 a / BG-252: this turn's make-out results, by observer, person and sense. The make-out roll (src/engine/makeOut.ts)
// writes them; everything that shows who is seen clearly (seenActors in src/views) reads them, so someone made out is
// named everywhere that turn, not only in the event.
import type { GameState } from '../types';
import { FN } from '../library/functionIds';

export type MadeOutSense = typeof FN.sight | typeof FN.hearing;
const key = (observerId: string, actorId: string, fn: MadeOutSense) => `${observerId}>${actorId}:${fn}`;

/** this turn's results (a new turn starts empty) */
function doneThisTurn(state: GameState): Record<string, boolean> {
  const sc = (state.scratch ??= {});
  const cur = sc.madeOut as { turn: number; done: Record<string, boolean> } | undefined;
  if (cur?.turn === state.turn) return cur.done;
  sc.madeOut = { turn: state.turn, done: {} };
  return (sc.madeOut as { done: Record<string, boolean> }).done;
}
/** the result of this turn's make-out roll by `observerId` on `actorId` with `fn`, if one was made */
export const madeOutResult = (state: GameState, observerId: string, actorId: string, fn: MadeOutSense): boolean | undefined =>
  doneThisTurn(state)[key(observerId, actorId, fn)];
export function recordMadeOut(state: GameState, observerId: string, actorId: string, fn: MadeOutSense, passed: boolean): boolean {
  return (doneThisTurn(state)[key(observerId, actorId, fn)] = passed);
}
/** BG-252: `observerId` made `actorId` out by sight this turn */
export const madeOutBySight = (state: GameState, observerId: string, actorId: string): boolean => madeOutResult(state, observerId, actorId, FN.sight) === true;
