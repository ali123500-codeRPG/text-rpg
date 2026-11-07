// Part 2, Resolution engine: the Ruleset interface and its request/result types.
import type { Effect, GameEvent, Tier } from './core';
import type { Actor } from './actor';
import type { GameState } from './state';
import type { GearOp } from './items';

export interface Rng {
  /** current internal state (saved as rngState) */
  readonly state: number;
  /** float in [0,1) */
  next(): number;
  /** integer in [min,max] inclusive */
  int(min: number, max: number): number;
  /** 1..100 (00 = 100) */
  d100(): number;
}

export type ModType = 'roll_perk' | 'wounds' | 'situational' | 'aim' | 'gear';
export type Mod = { source: string; type: ModType; value: number };
export type TierShift = { source: string; value: number };

export type CheckRequest = { actorId: string; skill: string; target?: string; modifiers: { source: string; value: number }[] };
export type CheckResult = {
  actorId: string;
  skill: string; // the skill actually used (after substitution)
  target: number;
  passed: boolean;
  modifiers: CheckRequest['modifiers'];
};

export type RollRequest = {
  actorId: string;
  skill: string;
  modifiers: Mod[];
  tierShifts: TierShift[];
  /** roll() adds the actor's own wounds and gear modifiers unless false (callers that already added them pass false) */
  auto?: boolean;
  /** gear context: the item instance used, for withItem effects; RollKind for noted roll modifiers */
  itemId?: string;
  rollKind?: import('./items').RollKind;
};
export type RollResult = {
  actorId: string;
  skill: string;
  d100: number;
  margin: number;
  tier: Tier; // unclamped tier ID; tierName() gives the nearest named tier
  natural: -2 | -1 | 0 | 1 | 2;
  modifiers: Mod[];
  tierShifts: TierShift[];
};
export type ContestResult = { a: RollResult; b: RollResult; gap: number; winner: 'a' | 'b' | 'tie' };

export type SituationResult = {
  actorId: string;
  roll: number;
  tier: Tier;
  modifiers: { source: string; type: 'perk' | 'gear' | 'status'; value: number }[];
};

export type AttackRequest = {
  attackerId: string;
  targetId: string;
  weaponId: string; // item instance id, or 'natural:<modeId>' / 'unarmed'
  modeId?: string; // attack mode id; code default if absent (Part 5 §5)
  targetPart: string | null;
  aimed: boolean;
  /** situational context computed by the engine */
  context?: {
    defenderUnaware?: boolean; // ambush surprise: unaware modifier on the defense
    defensesThisTurn?: number; // defenses the target already made this turn (outnumbered)
    attackerMods?: Mod[];
    defenderMods?: Mod[];
  };
};
export type AttackOutcome = 'missed' | 'dodged' | 'grazed' | 'blocked' | 'full_hit' | 'heavy_hit' | 'crushing_hit';
export type AttackResult = {
  attack: RollResult;
  defense: RollResult | null;
  defenseType: 'dodge' | 'block' | null;
  gap: number | null;
  gapShifts: TierShift[];
  outcome: AttackOutcome;
  location: string | null; // part id, 'general', or 'shield'
  locationHow: 'rolled' | 'aimed' | 'redirected' | 'restricted' | 'shield' | null;
  multiplier: number;
  damage: number; // code only; never reaches an agent
  deciding: { attack: string[]; defense: string[]; gap: string[] };
  // request echo, so applyEffects needs nothing else
  attackerId: string;
  targetId: string;
  weaponId: string;
  modeId: string;
  shieldItemId?: string;
};

export interface Ruleset {
  readonly TIERS: readonly Tier[]; // ordered best to worst
  initiative(actor: Actor, state: GameState, rng: Rng): number;
  check(req: CheckRequest, state: GameState, rng: Rng): CheckResult;
  contested(a: RollRequest, b: RollRequest, state: GameState, rng: Rng): ContestResult;
  roll(req: RollRequest, state: GameState, rng: Rng): RollResult;
  attack(req: AttackRequest, state: GameState, rng: Rng): AttackResult;
  situation(actor: Actor, state: GameState, rng: Rng): SituationResult;
  applyEffects(result: CheckResult | ContestResult | AttackResult, state: GameState): Effect[];
  recordUse(actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult, state: GameState): void;
}

export type OrderSource = 'player' | 'agent' | 'trigger' | 'onAlert' | 'routine' | 'fallback' | 'broken';

/** every order type the engine knows (trigger orders are checked against it) */
export const ORDER_TYPES = ['attack', 'move', 'search', 'hide', 'sneak', 'hold', 'call_help', 'alarm', 'flee', 'talk', 'persuade', 'deceive', 'barter',
  'intimidate', 'use_item', 'equip', 'give', 'observe', 'interact', 'rest', 'idle', 'other'] as const;
export type Order = {
  actorId: string;
  type: string; // attack | move | search | hide | sneak | hold | call_help | alarm | flee | talk | persuade | deceive | barter | intimidate | use_item | equip | give | observe | interact | rest | idle | other
  target: string | null;
  skill: string | null;
  intent: string;
  source: OrderSource;
  move?: string | null; // player: the turn's one move (toZone), resolved before the main action
  targetPart?: string | null;
  aimed?: boolean;
  defense?: 'dodge' | 'block' | null;
  item?: string | null;
  mode?: string | null;
  gear?: GearOp[] | null;
  line?: { text: string; volume: 'whisper' | 'normal' | 'shout'; introduces?: string[] } | null; // talk: speech; else a bark
  activity?: string; // routine idle/move activity
  addressees?: string[];
  triggerId?: string;
};

export type { GameEvent };
