// Replay (Part 2, Resolution engine): logged agent outputs, not the player's text, fed back through the engine
// from the record's rngBefore. Exact only under the library version the record names.
import type { GameEvent, GameState, Intent, Rng, TurnRecord } from '../types';
import type { AcceptedAgentOutput, ExchangeSpeech, TurnInput } from '../engine/types';
import { createRng } from '../rng';
import { tiersToIds } from './checks';

export type ReplayDeps = {
  /** the running library's version */
  libraryVersion: number;
  /** W4 resolveTurn */
  resolveTurn(state: GameState, input: TurnInput, rng: Rng): GameEvent[];
  /** W4 resolveSpeech, for dialogue turns (spokespeople in the log) */
  resolveSpeech?(state: GameState, intent: Intent, spokespeople: string[], rng: Rng): ExchangeSpeech;
  /** W6 director: scene setup from the record's situation roll and logged Weaver output. Must make no Claude call. */
  replaySceneStart?(state: GameState, record: TurnRecord, rng: Rng): GameEvent[];
  /** W4 turn start, as the pipeline's advance(): computePending moves the saved state (turn N-1) to turn N and fires turn-start triggers */
  startTurn?(state: GameState): void;
};

export class ReplayRefused extends Error {}

const USED = new Set(['ok', 'repaired', 'fallback']); // GAP: 'fallback' outputs are code-made orders the turn did use

export function replayTurn(stateBefore: GameState, rec: TurnRecord, deps: ReplayDeps): { state: GameState; events: GameEvent[]; rngState: number } {
  const record = structuredClone(rec);
  tiersToIds(record); // a record from a v1 save names its tiers
  if (record.libraryVersion !== deps.libraryVersion)
    throw new ReplayRefused(`turn ${record.turn} ran under library v${record.libraryVersion}; this is v${deps.libraryVersion}`);
  const state = structuredClone(stateBefore);
  const rng = createRng(record.rngBefore);
  const used = record.agentLog.filter((l) => USED.has(l.status) && l.output != null);
  // the last Parser call is the one that resolved; earlier ones in the record ended in a clarify question
  const intent = (used.filter((l) => l.agent === 'parser').at(-1)?.output as Intent | undefined) ?? null;
  const agentOutputs = used
    .filter((l) => l.agent === 'planner' || l.agent === 'responder' || l.agent === 'voice')
    .map((l) => ({ agent: l.agent, actorId: l.actorId!, output: l.output }) as AcceptedAgentOutput)
    .sort((a, b) => (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0)); // actor-id order, never call order
  if (record.situation && !deps.replaySceneStart) throw new ReplayRefused(`turn ${record.turn} started a scene: replay needs the scene director`);
  // story start (turn 0) is scene setup alone: no turn resolves
  if (record.situation && record.turn === 0) return { state, events: deps.replaySceneStart!(state, record, rng), rngState: rng.state };
  deps.startTurn?.(state);
  const spokespeople = [...new Set(used.filter((l) => l.agent === 'responder' || l.agent === 'voice').map((l) => l.actorId!))];
  const exchange = intent && spokespeople.length && deps.resolveSpeech ? deps.resolveSpeech(state, intent, spokespeople, rng) : undefined;
  const events = deps.resolveTurn(state, { intent, aimed: record.aimed ?? false, agentOutputs, spokespeople, ...(exchange ? { exchange } : {}) }, rng);
  if (record.situation) events.push(...deps.replaySceneStart!(state, record, rng));
  return { state, events, rngState: rng.state };
}
