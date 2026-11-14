// Part 2, Resolution engine: the Ruleset interface and its request/result types.
import type { SkillFunction } from './library';
import type { Effect, GameEvent, Tier } from './core';
import type { Actor, DefenseKind } from './actor';
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

export type ModType = 'roll_perk' | 'wounds' | 'situational' | 'aim' | 'gear' | 'achievement' | 'foe_perk' | 'status';
export type Mod = { source: string; type: ModType; value: number };
export type TierShift = { source: string; value: number };

export type CheckRequest = { actorId: string; skill: string; target?: string; modifiers: { source: string; value: number }[] };
export type CheckResult = {
  actorId: string;
  skill: string; // the skill actually used (after substitution)
  /** the skill the action asked for, when a stand-in made the roll (both learn) */
  asked?: string;
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
  /** skills that count at full value here instead of as substitutes (perks such as Threaten for Answers) */
  fullValue?: string[];
  /** a function roll: every skill with this function counts at full value and the best one rolls,
   * e.g. 'sight' = Eyesight or Tremor, 'hearing' = Earshot or Tremor. `skill` is then only the default. */
  fn?: SkillFunction;
  /** extra functions whose skills may stand in here (an attack mode's standInFns) */
  standInFns?: SkillFunction[];
  /** a combined roll (an attack mode's blend): each skill × its share, summed */
  blend?: { skill: string; share: number }[];
  /** body-part roles whose wounds count, instead of the skill's own (ST10: hiding is stealth without the move role) */
  roles?: import('./library').RoleId[];
  /** the opposing actor (attacks, defenses, contests): Bane bonuses read its race and body type (D-111) */
  against?: string;
  /** a roll made as one side of a contest: tier unlocks for roll 'contest' apply (D-292) */
  contest?: true;
  /** a Near Miss on this roll counts one tier higher, with this source (All-50 Hushed Steps against listeners) */
  nearMissUp?: string;
};
export type RollResult = {
  actorId: string;
  skill: string;
  /** the skill the action asked for, when a stand-in made the roll (both learn) */
  asked?: string;
  /** a combined roll: the skills that rolled each part (after stand-ins); each learns */
  parts?: string[];
  /** the roll's kind, when it had one: augments limited to roll kinds learn only from their own kinds */
  rollKind?: import('./items').RollKind;
  d100: number;
  margin: number;
  tier: Tier; // clamped to the TIERS table
  beyond?: number; // steps a shifted roll went past the end tier (+ above, − below); tierLevel() adds it
  natural: -1 | 0 | 1;
  modifiers: Mod[];
  tierShifts: TierShift[];
};
export type ContestResult = { a: RollResult; b: RollResult; gap: number; winner: 'a' | 'b' | 'tie' };

export type EventRollResult = {
  actorId: string;
  roll: number;
  tier: Tier;
  /** steps past the end tier (Critical Success+ / Critical Failure−), only when an achievement opens them */
  beyond?: number;
  modifiers: { source: string; type: 'perk' | 'gear' | 'status' | 'achievement' | 'situational'; value: number }[]; // situational: night travel (TV4)
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
    attackerShifts?: TierShift[]; // engine-side shifts on the attack roll (All-50 Opening Strike)
    defenderShifts?: TierShift[]; // engine-side shifts on the defense roll (All-50 Unerring)
  };
};
/** keys of HIT_OUTCOMES (src/scales.ts) */
export type AttackOutcome = import('../scales').HitOutcome;
export type AttackResult = {
  attack: RollResult;
  unaware?: true; // the target was unaware of the attacker
  defense: RollResult | null;
  defenseType: DefenseKind | null;
  gap: number | null;
  gapShifts: TierShift[];
  outcome: AttackOutcome;
  location: string | null; // part id, 'general', or 'shield'
  locationHow: 'rolled' | 'aimed' | 'redirected' | 'restricted' | 'shield' | 'open_hand' | null;
  multiplier: number;
  damage: number; // code only; never reaches an agent
  deciding: { attack: string[]; defense: string[]; gap: string[] };
  // request echo, so applyEffects needs nothing else
  attackerId: string;
  targetId: string;
  weaponId: string;
  modeId: string;
  shieldItemId?: string;
  shieldMult?: number; // A3 Shield Breaker: the shield pool takes this multiple of the damage
  legBolt?: boolean; // A6 Leg Bolt: the leg's pool takes CONFIG.LEG_BOLT_PART_MULT× the damage, and the target is slowed
  strikeBack?: true; // PA4: a parry at the strike gap or better; the engine gives the defender one free melee attack back
  /** A7 Open-Hand Guard: of `damage`, this much goes to the general area; the rest lands on the parrying arm (location) */
  generalShare?: number;
};

export interface Ruleset {
  initiative(actor: Actor, state: GameState, rng: Rng): number;
  check(req: CheckRequest, state: GameState, rng: Rng): CheckResult;
  contested(a: RollRequest, b: RollRequest, state: GameState, rng: Rng): ContestResult;
  roll(req: RollRequest, state: GameState, rng: Rng): RollResult;
  attack(req: AttackRequest, state: GameState, rng: Rng): AttackResult;
  /** `extra`: modifiers the caller adds (night travel, TV4) */
  eventRoll(actor: Actor, state: GameState, rng: Rng, extra?: EventRollResult['modifiers']): EventRollResult;
  applyEffects(result: CheckResult | ContestResult | AttackResult, state: GameState): Effect[];
  recordUse(actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult, state: GameState): void;
}

export type OrderSource = 'player' | 'agent' | 'trigger' | 'onAlert' | 'routine' | 'fallback' | 'broken';

/** every order type the engine knows (trigger orders are checked against it) */
export const ORDER_TYPES = ['attack', 'move', 'search', 'hide', 'sneak', 'vanish', 'hold', 'call_help', 'alarm', 'flee', 'talk', 'persuade', 'deceive', 'barter',
  'intimidate', 'use_item', 'equip', 'give', 'buy', 'sell', 'observe', 'interact', 'rest', 'wait', 'sleep', 'idle', 'pick', 'stash', 'open', 'restrain', 'filch', 'steady', 'show', 'other'] as const;
/** BG-128: orders aimed at a way (a zone), never at a person: picking a lock (the player may also pick a container's, CT3) */
export const WAY_ORDERS: readonly string[] = ['pick'];
export type Order = {
  actorId: string;
  type: string; // attack | move | search | hide | sneak | hold | call_help | alarm | flee | talk | persuade | deceive | barter | intimidate | use_item | equip | give | observe | interact | rest | wait | sleep | idle | other
  target: string | null;
  skill: string | null;
  intent: string;
  source: OrderSource;
  move?: string | null; // the turn's one move (toZone), resolved before the main action (player, or an NPC's Planner/Responder)
  moveAfter?: boolean; // AE3: the player's move comes after the main action
  pace?: import('../scales').TravelPaceKey; // TV2: the player's travel pace on a road trip (normal when left out)
  moveSpot?: import('./agents').MoveSpot; // BG-12: where in the move's zone the player heads
  jump?: true; // SD7: the move jumps down a drop link (a window, a ledge)
  way?: { toZone: string; op: import('../engine/barriers').WayOp }; // BA3/BA4: a key turned or a bar slid on purpose, in the move slot
  vanish?: true; // ST13: the player's move is a Vanish
  perkMove?: { perk: string; target: string | null }; // AE5/AE8: a perk move (perkMoves.ts)
  targetPart?: string | null;
  aimed?: boolean;
  defense?: DefenseKind | null;
  item?: string | null;
  qty?: number | null; // give, buy: how many (give null: the whole stack; buy null: one)
  for?: string | null; // buy: who gets it (null: the buyer)
  mode?: string | null;
  gear?: GearOp[] | null;
  line?: { text: string; volume: import('./agents').Volume; to?: string } | null; // talk: speech; else a bark; to (BG-132): a reply's listener
  activity?: string; // routine idle/move activity
  addressees?: string[];
  triggerId?: string;
};

export type { GameEvent };
