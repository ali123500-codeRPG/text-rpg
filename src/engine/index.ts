// W4 — Resolution engine, triggers, hidden state, modes, spokespeople, gear ops.
import type { GameEvent, GameState, Intent, Order, Pending, Rng } from '../types';
import type { ExchangeSpeech, TurnInput } from './types';
import { todo } from '../todo';
export * from './types';

/** Architecture step 1: after turn N is saved, compute turn N+1 — fire turn-start triggers, engaged set, mode (pre-Parser). */
export function computePending(state: GameState): Pending { return todo('computePending'); }
/** Dialogue turn step 2: one spokesperson per addressed band (named member, else nearest, ties by id), at most MAX_SPOKESPEOPLE, never inactive. */
export function selectSpokespeople(state: GameState, intent: Intent): string[] { return todo('selectSpokespeople'); }
/** Exchange slot part 1: the player's speech roll contested per spokesperson; impressions, SLIPS. Uses rng. */
export function resolveSpeech(state: GameState, intent: Intent, spokespeople: string[], rng: Rng): ExchangeSpeech { return todo('resolveSpeech'); }
/** One turn of pure resolution. Same state + same input + same rng = same events. */
export function resolveTurn(state: GameState, input: TurnInput, rng: Rng): GameEvent[] { return todo('resolveTurn'); }
/** Order for the player from the Parser's intent (aimed is code-set). */
export function fromIntent(state: GameState, intent: Intent | null, aimed: boolean): Order { return todo('fromIntent'); }
