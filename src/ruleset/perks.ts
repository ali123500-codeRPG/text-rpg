// Part 1 §3/§5 (perk page S1–S9): true skill and skill ladders. True skill = raw + flat, always-on
// skill perks; ladder milestones and all-XXX perks read it. A milestone unlocks at 20, 40 … 140 true skill; taking its perk costs one
// perk point and can be undone until the next turn is played (K3).
import type { Actor, GameState, PerkDef } from '../types';
import { getLibrary } from '../library';
import { skillOpen } from './access';
import { groupsOf } from '../library/functionNames';

export const MILESTONES = [20, 40, 60, 80, 100, 120, 140] as const;
/** all-XXX perks (formerly mastery perks; save key 'mastery'): granted when all three skills of a tree reach 50/100/150 */
export const ALL_STEPS = [50, 100, 150] as const;
/** ladder perks already taken in the same skill before a milestone shows; all-XXX perks don't count */
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
  if (!e || e.dormant || !skillOpen(a, skill)) return 0; // a closed tree counts as 0 (TA4)
  const { perks, skills } = getLibrary();
  const groups = groupsOf(skills[skill]);
  return e.raw + owned(a).reduce((n, p) => {
    const d = perks[p.perkId];
    const own = d?.ladder?.skill;
    if (!d) return n;
    let v = d.trueSkill && own === skill ? d.trueSkill : 0;
    v += d.trueSkillTo?.[skill] ?? 0; // 40/80/120 perks: true skill spent on skills that work well with the ladder skill
    if (d.fnSkill && (skills[skill]?.functions as string[] | undefined)?.includes(d.fnSkill.fn)) v += d.fnSkill.add; // Hunter's Eye
    // 40/80/120 perks: +functionBoost to the ladder skill itself and every other skill sharing a group with it
    // (docs/skill-tags.md: "+1 function (including itself)"; F1: the broad group)
    if (d.functionBoost && own && (own === skill || groupsOf(skills[own]).some((g) => groups.includes(g)))) v += d.functionBoost;
    return n + v;
  }, 0);
}

/** F4: the owner's perk change to the stand-in share for a function (PerkDef.standIn) */
export const standInAdd = (a: Actor, fn: string): number =>
  owned(a).reduce((n, p) => { const s = getLibrary().perks[p.perkId]?.standIn; return n + (s && (!s.fn || s.fn === fn) ? s.add : 0); }, 0);

/** a 40/80/120 perk number for rolls of one skill: multipliers multiply, armorPierce adds (src/library/boostPerks.ts) */
export function boostMult(a: Actor, skill: string, key: 'aimMult' | 'damageMult' | 'recoveryMult'): number {
  const perks = getLibrary().perks;
  return owned(a).reduce((m, p) => { const d = perks[p.perkId]; return d?.ladder?.skill === skill ? m * (d.numbers?.[key] ?? 1) : m; }, 1);
}
/** 40/80/120 perk roll modifiers for one skill: rollAdd on every roll, hitAdd on attack rolls only, each named by its perk */
export function boostRollMods(a: Actor, skill: string, attack: boolean): { source: string; type: 'roll_perk'; value: number }[] {
  const perks = getLibrary().perks;
  return owned(a).flatMap((p) => {
    const d = perks[p.perkId];
    const v = d?.ladder?.skill === skill ? (d.numbers?.rollAdd ?? 0) + (attack ? d.numbers?.hitAdd ?? 0 : 0) : 0;
    return v ? [{ source: d!.name, type: 'roll_perk' as const, value: v }] : [];
  });
}
export function boostAdd(a: Actor, skill: string, key: 'armorPierce'): number {
  const perks = getLibrary().perks;
  return owned(a).reduce((n, p) => { const d = perks[p.perkId]; return d?.ladder?.skill === skill ? n + (d.numbers?.[key] ?? 0) : n; }, 0);
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
