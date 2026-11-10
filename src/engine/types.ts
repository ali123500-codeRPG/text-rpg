import type { Intent, Order, PlannerOutput, ResponderOutput, VoiceOutput, ContestResult, GameEvent, Tier } from '../types';

export type AcceptedAgentOutput =
  | { agent: 'planner'; actorId: string; output: PlannerOutput }
  | { agent: 'responder'; actorId: string; output: ResponderOutput }
  | { agent: 'voice'; actorId: string; output: VoiceOutput };

/** exchange slot part 1, computed after the Parser and before dialogue calls */
export type ExchangeSpeech = {
  skill: string; // speech skill actually used (after substitution)
  playerTier: Tier;
  impression: string | null; // fixed words from the tier (Dialogue input table)
  perSpokesperson: Record<string, { contest: ContestResult; slips: string[]; tell?: true }>; // tell: the listener saw through a lie
};

export type TurnInput = {
  intent: Intent | null; // null: the player holds
  aimed: boolean; // from the Aim toggle or /aim; the Parser never sets it
  agentOutputs: AcceptedAgentOutput[]; // validated; merged in actor-id order
  spokespeople: string[];
  exchange?: ExchangeSpeech;
  /** A15 Quick Word: the exchange rides beside the player's action, and the replies are free */
  quickWord?: boolean;
  /** orders fired at turn start (from pending), already bound */
  fired?: Order[];
};
export type { Intent, GameEvent };
