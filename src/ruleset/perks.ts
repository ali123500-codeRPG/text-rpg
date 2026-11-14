// Part 1 §3/§5 (perk page S1–S9): true skill and skill ladders. True skill = raw + flat, always-on
// skill perks; ladder milestones and all-XXX perks read it. A milestone unlocks at 20, 40 … 140 true skill; taking its perk costs one
// perk point and can be undone until the next turn is played (K3).
import { achievementSkill } from './achRewards';
import type { Actor, GameState, PerkDef } from '../types';
import { getLibrary } from '../library';
import { skillOpen } from './access';
import { groupsOf } from '../library/functionNames';
import { COVER, LIGHT } from '../scales';
import { PK } from '../library/perkIds';
import { AURA_SKILLS } from '../library/auras';
import { syncPerkLinks } from './perkLinks';
import { CONFIG } from '../config';
import { PERK_THEMES, type PayoffCount } from '../library/perkThemes';

/** CS11: every `every` points up to `top`, with no top of its own */
const series = (every: number, top: number): number[] => Array.from({ length: Math.max(0, Math.floor(top / every)) }, (_, i) => (i + 1) * every);
/** CS11: a ladder perk milestone every PERK_MILESTONE_EVERY points of true skill, with no top; one past the last written
 * perk is "empty" (reached, no perk yet) */
export const milestonesUpTo = (top: number): number[] => series(CONFIG.PERK_MILESTONE_EVERY, top);
/** CS11: All-XXX steps (formerly mastery perks; save key 'mastery') every ALL_STEP_EVERY points of true skill, with no top */
export const allStepsUpTo = (top: number): number[] => series(CONFIG.ALL_STEP_EVERY, top);
/** the milestones and All steps the perk rails always show (to PERK_RAILS_TO); the series go on past them */
export const MILESTONES = milestonesUpTo(CONFIG.PERK_RAILS_TO);
export const ALL_STEPS = allStepsUpTo(CONFIG.PERK_RAILS_TO);
/** ladder perks already taken in the same skill before a milestone shows (0, 0, 1, 1, 2, 2, 3 … from 20 up); all-XXX
 * perks don't count */
export const perksNeeded = (milestone: number): number => Math.max(0, Math.floor((milestone / CONFIG.PERK_MILESTONE_EVERY - 1) / 2));

const owned = (a: Actor) => a.core.perks.filter((p) => !p.dormant);
/** the sum of one perk number over an actor's active perks */
export const perkSum = (a: Actor, key: 'hearingDb' | 'throwReach') => owned(a).reduce((n, p) => n + (getLibrary().perks[p.perkId]?.[key] ?? 0), 0);
/** the actor owns this perk and it is not dormant: every coded perk checks this */
export const hasPerk = (a: Actor | undefined, perkId: string) => !!a?.core.perks.some((p) => p.perkId === perkId && !p.dormant);

/** AE5/AE8: perk moves code can resolve (engine/perkMoves.ts): whether each is free and how often an engagement allows it.
 * `does` tells the Parser what the move looks like in the player's words, so it is found without its name */
export const PERK_MOVES: Record<string, { free: boolean; perEngagement?: number; perFoe?: true; untargeted?: true; does: string }> = {
  [PK.dirt_in_the_eyes]: { free: true, perEngagement: 1, does: "throw dirt, sand, a drink or anything at hand in a foe's eyes" },
  // LI1c: once per foe per engagement
  // I9: the turn's main action, once per engagement, aimed at no one
  [PK.battle_cry]: { free: false, perEngagement: 1, untargeted: true, does: 'a war cry or roar to shake the foes and rally your side ("Come on, then!", a wordless bellow)' },
  [PK.bluff]: { free: true, perEngagement: 1, perFoe: true, does: 'a quick lie or false warning at a foe, to make it look away or hesitate ("Behind you!", "Your boot\'s untied", pointing at nothing)' },
};
/** the perk moves an actor owns (shown to the Parser and in Commands) */
export const ownPerkMoves = (a: Actor): string[] => Object.keys(PERK_MOVES).filter((id) => hasPerk(a, id));

/** the actor's true skill: flat parts (raw, perks, achievements, essences) plus the 120 perks' shares (SH1, SH4), which read
 * flat true skill only, so they never feed each other; several shares on one skill stack by STACK_RATIO (SH7 b) */
export function trueSkill(a: Actor, skill: string): number {
  const e = a.core.skills[skill];
  if (!e || e.dormant || !skillOpen(a, skill)) return 0;
  const flat = flatTrueSkill(a, skill);
  const { perks, skills } = getLibrary();
  const groups = groupsOf(skills[skill]);
  const shares = owned(a).flatMap((p) => {
    const d = perks[p.perkId], own = d?.ladder?.skill;
    if (!d || !own || (!d.shareOwn && !d.shareGroup)) return [];
    const base = own === skill ? flat : flatTrueSkill(a, own);
    return [own === skill ? (d.shareOwn ?? 0) * base : 0,
      d.shareGroup && (own === skill || groupsOf(skills[own]).some((g) => groups.includes(g))) ? d.shareGroup * base : 0].filter((v) => v);
  });
  return flat + shares.sort((x, y) => y - x).reduce((s, x, i) => s + x * CONFIG.STACK_RATIO ** i, 0);
}
function flatTrueSkill(a: Actor, skill: string): number {
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
    if (d.auraSkill && AURA_SKILLS.includes(skill)) v += d.auraSkill; // linked perk Crushing Presence
    if (d.fnSkill && (skills[skill]?.functions as string[] | undefined)?.includes(d.fnSkill.fn)) v += d.fnSkill.add; // Hunter's Eye
    // 40/80/120 perks: +functionBoost to the ladder skill itself and every other skill sharing a group with it
    // (docs/skill-tags.md: "+1 function (including itself)"; F1: the broad group)
    if (d.functionBoost && own && (own === skill || groupsOf(skills[own]).some((g) => groups.includes(g)))) v += d.functionBoost;
    return n + v;
  }, 0) + achievementSkill(a, skill) + essenceSkill(a, skill);
}
/** growth proposal 2.2/EG4 a: the true skill the actor's held essences add (thread, not body: it counts everywhere true skill does) */
export const essenceSkill = (a: Actor, skill: string): number => (a.progression?.essences ?? []).reduce((n, e) => n + (e.points[skill] ?? 0), 0);

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
const gated = (a: Actor, skill: string, milestone: number) => !hasPerk(a, PK.as_far_as_the_road_goes) && ladderPerksIn(a, skill) < perksNeeded(milestone);

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
  syncPerkLinks(a, s.turn); // linked perks
}

/** undo is open until the next turn is played (K3): the perk was gained on the current, unplayed turn */
export const canUndo = (s: GameState, a: Actor, perkId: string) =>
  a.core.perks.some((p) => p.perkId === perkId && p.source === 'level' && p.gainedTurn === s.turn);

export function undoPerk(s: GameState, a: Actor, perkId: string): void {
  if (!canUndo(s, a, perkId)) throw new Error(`cannot undo ${perkId}`);
  a.core.perks = a.core.perks.filter((p) => p.perkId !== perkId);
  a.progression!.unspentPerkPoints += 1;
  syncPerkLinks(a, s.turn);
}

/** A19 Melt Away: a zone with some cover or more, or light dim or darker, lets the owner vanish in place */
export const meltAwayHere = (cover: string | undefined, light: string | undefined): boolean =>
  COVER.pos(COVER.keyOf(cover) ?? 'none') >= COVER.pos('some') || LIGHT.pos(LIGHT.keyOf(light) ?? 'bright') >= LIGHT.pos('dim');

/** CN3 a: the pieces a payoff perk counts: owned perks with the theme tag (or quirks), whatever their source, each counted
 * once. Dormant perks count for now (D-307). */
export function themeCount(a: Actor, what: PayoffCount): number {
  const perks = getLibrary().perks;
  return new Set(a.core.perks.map((p) => p.perkId).filter((id) => what === 'quirk' ? perks[id]?.quirk : PERK_THEMES[what].includes(id))).size;
}
/** CN4 a: a payoff perk's share for this many pieces: PAYOFF_SHARE for the first, each further one STACK_RATIO of the one
 * before (5%, 2.5%, 1.25% …, never past twice PAYOFF_SHARE) */
export const payoffShare = (pieces: number): number => Array.from({ length: pieces }, (_, i) => CONFIG.PAYOFF_SHARE * CONFIG.STACK_RATIO ** i).reduce((n, x) => n + x, 0);
