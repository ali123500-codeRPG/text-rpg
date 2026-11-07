// Part 1 §3/§5 (Ali, 07/11/2026, perk page S1–S9): true skill and skill ladders. True skill = raw + flat, always-on
// skill perks; ladder milestones and all-XXX perks read it. A milestone unlocks at 20, 40 … 140 true skill; taking its perk costs one
// perk point and can be undone until the next turn is played (K3).
import type { Actor, GameState, PerkDef } from '../types';
import { getLibrary } from '../library';

export const MILESTONES = [20, 40, 60, 80, 100, 120, 140] as const;
/** all-XXX perks (formerly mastery perks; save key 'mastery'): granted when all three skills of a tree reach 50/100/150 */
export const ALL_STEPS = [50, 100, 150] as const;
/** ladder perks already taken in the same skill before a milestone shows (Ali, 07/11/2026); all-XXX perks don't count */
export const PERKS_NEEDED: Record<number, number> = { 20: 0, 40: 0, 60: 1, 80: 1, 100: 2, 120: 2, 140: 3 };

const owned = (a: Actor) => a.core.perks.filter((p) => !p.dormant);
/** the actor owns this perk and it is not dormant: every coded perk checks this */
export const hasPerk = (a: Actor | undefined, perkId: string) => !!a?.core.perks.some((p) => p.perkId === perkId && !p.dormant);

/** AE5/AE8: perk moves code can resolve (engine/perkMoves.ts): whether each is free and how often an engagement allows it */
export const PERK_MOVES: Record<string, { free: boolean; perEngagement?: number }> = {
  dirt_in_the_eyes: { free: true, perEngagement: 1 },
};
/** the perk moves an actor owns (shown to the Parser and in Commands) */
export const ownPerkMoves = (a: Actor): string[] => Object.keys(PERK_MOVES).filter((id) => hasPerk(a, id));

export function trueSkill(a: Actor, skill: string): number {
  const e = a.core.skills[skill];
  if (!e || e.dormant) return 0;
  const perks = getLibrary().perks;
  return e.raw + owned(a).reduce((n, p) => {
    const d = perks[p.perkId];
    return n + (d?.trueSkill && d.ladder?.skill === skill ? d.trueSkill : 0);
  }, 0);
}

/** ladder perks this actor owns in one skill */
export const ladderPerksIn = (a: Actor, skill: string) =>
  a.core.perks.filter((p) => p.source === 'level' && getLibrary().perks[p.perkId]?.ladder?.skill === skill).length;
const gated = (a: Actor, skill: string, milestone: number) => ladderPerksIn(a, skill) < (PERKS_NEEDED[milestone] ?? 0);

/** the library perk on one milestone of a skill's ladder, if written */
export function milestonePerk(skill: string, milestone: number): PerkDef | undefined {
  return Object.values(getLibrary().perks).find((d) => d.ladder?.skill === skill && d.ladder.milestone === milestone);
}

/** sealed: not reached, or too few perks taken in this skill (nothing about it is shown); empty: reached, no perk written yet; open: can be taken; own: taken */
export type MilestoneState = 'sealed' | 'empty' | 'open' | 'own';
export function milestoneState(a: Actor, skill: string, milestone: number): MilestoneState {
  const d = milestonePerk(skill, milestone);
  if (d && a.core.perks.some((p) => p.perkId === d.id)) return 'own'; // kept even if the skill drops (S4)
  if (trueSkill(a, skill) < milestone || gated(a, skill, milestone)) return 'sealed';
  return d ? 'open' : 'empty';
}

export function canTake(a: Actor, perkId: string): string | null {
  const d = getLibrary().perks[perkId];
  if (!d?.ladder) return 'not a ladder perk';
  if (a.core.perks.some((p) => p.perkId === perkId)) return 'already taken';
  if (d.built === false) return 'not in the game yet';
  if (!a.progression || a.progression.unspentPerkPoints < 1) return 'no perk point';
  if (trueSkill(a, d.ladder.skill) < d.ladder.milestone) return 'milestone not reached';
  if (gated(a, d.ladder.skill, d.ladder.milestone)) return 'too few perks in this skill';
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
