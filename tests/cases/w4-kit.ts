// Small helpers for W4's engine-level case tests (not a test file).
import type { GameEvent, GameState, Intent, NpcAction } from '../../src/types';
import type { AcceptedAgentOutput, TurnInput } from '../../src/engine';
import { computePending, firedOrders, resolveTurn } from '../../src/engine';
import { createRng } from '../harness';
import { checkTurn, snapTurn } from '../../src/save/turnCheck';

export type IntentArg = Omit<Partial<Intent>, 'action'> & { action?: Partial<NonNullable<Intent['action']>> };
export const intent = ({ action, ...p }: IntentArg = {}): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, ...p,
  action: action ? { type: 'other', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action } : null,
});

export const act = (type: NpcAction['type'], target: string | null = null, extra: Partial<NpcAction> = {}): NpcAction =>
  ({ type, target, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: '', ...extra });

export const plannerOut = (actorId: string, action: NpcAction, extra: Record<string, unknown> = {}): AcceptedAgentOutput =>
  ({ agent: 'planner', actorId, output: { action, dialogue: null, gear: null, stance: null, planUpdate: null, ...extra } }) as AcceptedAgentOutput;

/** one turn the way the pipeline runs it: resolve state.pending.turn, then compute the next pending. */
export function play(s: GameState, inp: Partial<TurnInput> = {}, seed = s.turn * 7919): GameEvent[] {
  s.turn = s.pending.turn;
  s.events = [];
  s.log = [];
  const before = snapTurn(s);
  const ev = resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [], fired: firedOrders(s), ...inp }, createRng(seed));
  checkTurn(s, before, ev); // TQ1: every world rule holds after the turn
  computePending(s);
  return ev;
}
