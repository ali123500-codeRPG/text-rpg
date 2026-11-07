// Part 1 §3/§5 (Ali, 07/11/2026, perk page S1–S9): true skill and skill ladders. True skill = raw + flat, always-on
// skill perks; ladder milestones and mastery read it. A milestone unlocks at 20, 40 … 140 true skill; taking its perk costs one
// perk point and can be undone until the next turn is played (K3).
import type { Actor, GameState, PerkDef } from '../types';
import { getLibrary } from '../library';

export const MILESTONES = [20, 40, 60, 80, 100, 120, 140] as const;
export const MASTERY_STEPS = [50, 100, 150] as const;

const owned = (a: Actor) => a.core.perks.filter((p) => !p.dormant);

export function trueSkill(a: Actor, skill: string): number {
  const e = a.core.skills[skill];
  if (!e || e.dormant) return 0;
  const perks = getLibrary().perks;
  return e.raw + owned(a).reduce((n, p) => {
    const d = perks[p.perkId];
    return n + (d?.trueSkill && d.ladder?.skill === skill ? d.trueSkill : 0);
  }, 0);
}

/** the library perk on one milestone of a skill's ladder, if written */
export function milestonePerk(skill: string, milestone: number): PerkDef | undefined {
  return Object.values(getLibrary().perks).find((d) => d.ladder?.skill === skill && d.ladder.milestone === milestone);
}

/** sealed: not reached (nothing about it is shown); empty: reached, no perk written yet; open: can be taken; own: taken */
export type MilestoneState = 'sealed' | 'empty' | 'open' | 'own';
export function milestoneState(a: Actor, skill: string, milestone: number): MilestoneState {
  const d = milestonePerk(skill, milestone);
  if (d && a.core.perks.some((p) => p.perkId === d.id)) return 'own'; // kept even if the skill drops (S4)
  if (trueSkill(a, skill) < milestone) return 'sealed';
  return d ? 'open' : 'empty';
}

export function canTake(a: Actor, perkId: string): string | null {
  const d = getLibrary().perks[perkId];
  if (!d?.ladder) return 'not a ladder perk';
  if (a.core.perks.some((p) => p.perkId === perkId)) return 'already taken';
  if (!a.progression || a.progression.unspentPerkPoints < 1) return 'no perk point';
  if (trueSkill(a, d.ladder.skill) < d.ladder.milestone) return 'milestone not reached';
  return null;
}

export function takePerk(s: GameState, a: Actor, perkId: string): void {
  const why = canTake(a, perkId);
  if (why) throw new Error(`cannot take ${perkId}: ${why}`);
  a.progression!.unspentPerkPoints -= 1;
  a.core.perks.push({ perkId, source: 'level', gainedTurn: s.turn });
}

/** undo is open until the next turn is played (K3): the perk was gained on the current, unplayed turn */
export const canUndo = (s: GameState, a: Actor, perkId: string) =>
  a.core.perks.some((p) => p.perkId === perkId && p.source === 'level' && p.gainedTurn === s.turn);

export function undoPerk(s: GameState, a: Actor, perkId: string): void {
  if (!canUndo(s, a, perkId)) throw new Error(`cannot undo ${perkId}`);
  a.core.perks = a.core.perks.filter((p) => p.perkId !== perkId);
  a.progression!.unspentPerkPoints += 1;
}
