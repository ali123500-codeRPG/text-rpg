// W2 — Ruleset and gear maths. Part 1 §3–4, Part 3, Part 5 §2–6.
// Contract: the eight Ruleset methods plus the helpers below. Every number comes from CONFIG.
import type { Actor, AttackMode, GameState, HealthLevel, Mod, PartState, Ruleset, Tier } from '../types';
import { TIER_NAMES } from '../config';
import { todo } from '../todo';

export const TIERS: readonly Tier[] = [...TIER_NAMES].reverse(); // best to worst
/** 0 = Critical Failure … 5 = Critical Success */
export function tierIndexOf(tier: Tier): number {
  return TIER_NAMES.indexOf(tier as (typeof TIER_NAMES)[number]);
}
export function tierName(index: number): Tier {
  return TIER_NAMES[Math.max(0, Math.min(5, index))];
}

export const ruleset: Ruleset = {
  TIERS,
  initiative: () => todo('ruleset.initiative'),
  check: () => todo('ruleset.check'),
  contested: () => todo('ruleset.contested'),
  roll: () => todo('ruleset.roll'),
  attack: () => todo('ruleset.attack'),
  situation: () => todo('ruleset.situation'),
  applyEffects: () => todo('ruleset.applyEffects'),
  recordUse: () => todo('ruleset.recordUse'),
};

/** Stacking within one modifier type (Part 1 §4). */
export function stackType(values: number[]): number { return todo('stackType'); }
/** Effective skill for one check or roll (Part 1 §3), with substitution: returns the skill actually used. */
export function effectiveSkill(state: GameState, actor: Actor, skill: string, ctx?: { itemId?: string; modeId?: string }): { skill: string; value: number; gear: { source: string; value: number }[] } { return todo('effectiveSkill'); }
export function totalHp(state: GameState, actor: Actor): number { return todo('totalHp'); }
export function healthLevel(actor: Actor): HealthLevel { return todo('healthLevel'); }
export function partStates(state: GameState, actor: Actor): { id: string; state: PartState }[] { return todo('partStates'); }
/** wounds-type roll modifiers for a skill: health-track level plus body-part role penalties. */
export function woundsMods(state: GameState, actor: Actor, skill: string): Mod[] { return todo('woundsMods'); }
/** d100 bands, database order, general area last; Destroyed parts removed. */
export function hitTable(state: GameState, actor: Actor): { part: string; from: number; to: number }[] { return todo('hitTable'); }
/** morale check (Part 3, Morale): roll() with Mind.morale. Fearless never checks; reaching Critical always breaks. */
export function moraleCheck(state: GameState, actor: Actor, rng: import('../types').Rng, reason: 'level' | 'bandmate_down'): 'steady' | 'broken' | 'surrendered' { return todo('moraleCheck'); }
/** attack modes the actor can use now: held weapon modes, else natural/unarmed. */
export function usableModes(state: GameState, actor: Actor): { itemId: string; mode: AttackMode }[] { return todo('usableModes'); }
/** Part 5 §5 default mode: first held mode whose reach covers `distance` links, else the unarmed mode. */
export function defaultMode(state: GameState, actor: Actor, distance: number): { itemId: string; mode: AttackMode } | null { return todo('defaultMode'); }
/** skill id of an attack mode (tree + class; unarmed: mode.skill). */
export function modeSkill(mode: AttackMode): string { return todo('modeSkill'); }
/** situation-roll modifiers from perks, gear and statuses naming the situation roll (one copy counts). */
export function situationMods(state: GameState, actor: Actor): { source: string; type: 'perk' | 'gear' | 'status'; value: number }[] { return todo('situationMods'); }
/** Part 5 §2 Tools: best carried tool for a skill; may stow the off-hand item (free). */
export function pickTool(state: GameState, actor: Actor, skill: string): { itemId: string | null; stowed: string | null } { return todo('pickTool'); }
