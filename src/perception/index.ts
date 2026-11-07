// W3 — Perception per event, the single belief writer, communication events, belief decay.
import type { BeliefStatus, CheckResult, ContestResult, AttackResult, GameEvent, GameState, Rng } from '../types';
import { todo } from '../todo';

export type BeliefUpdate =
  | { kind: 'event'; event: GameEvent; result?: CheckResult | ContestResult | AttackResult }
  | { kind: 'detection'; observerId: string; aboutId: string; status: BeliefStatus; event: GameEvent }
  | { kind: 'opening'; observerId: string; aboutId: string; status: BeliefStatus; zone?: string; source?: 'seen' | 'heard' | 'told' }
  | { kind: 'reveal'; observerId: string; aboutId: string; fact: string };

/** who perceives `event`, at the moment it happens (level and cue). The player's own events reach observers unaware of the player only through detection. */
export function computePerception(event: GameEvent, state: GameState, rng: Rng): GameEvent['perception'] { return todo('computePerception'); }
/** the ONLY writer of Belief. */
export function updateBeliefs(state: GameState, update: BeliefUpdate): void { return todo('updateBeliefs'); }
/** one step down when lastSeenTurn is older than DECAY_TURNS. */
export function applyBeliefDecay(state: GameState): void { return todo('applyBeliefDecay'); }
