// Part 1 §6 skill improvement ("Skill progression: options" SP1–SP11).
// A use marks a skill when the opposition is within MARK_WINDOW of the user's raw or true skill (SP2, SP6); a hit that
// costs ENDURANCE_MARK_PCT health or more marks endurance (SP5); a hit your armor covers can mark its armor skill (AR5). Marked skills roll at the end of each engagement or
// when the scene breaks (SP3). Only the player keeps marks for now (SP7). Failed improvement rolls show nothing (SP11).
import type { Actor, AttackResult, CheckResult, ContestResult, GameState, Rng } from '../types';
import { CONFIG } from '../config';
import { actorById } from '../engine/relations';
import { MILESTONES, trueSkill } from './perks';
import { skillOpen } from './access';
import { getLibrary, itemDef } from '../library';
import { requirement } from './requirements';
import { SK } from '../library/skillIds';

function mark(actor: Actor, skill: string): void {
  const pr = actor.progression;
  if (pr && actor.core.skills[skill] && skillOpen(actor, skill) && !pr.marks.includes(skill)) pr.marks.push(skill); // a closed tree can't be raised (TA4)
}

/** is `opposition` within MARK_WINDOW of the actor's raw or true skill (SP2) */
function close(actor: Actor, skill: string, opposition: number): boolean {
  const raw = actor.core.skills[skill]?.raw;
  if (raw === undefined) return false;
  const w = CONFIG.MARK_WINDOW;
  return Math.abs(opposition - raw) <= w || Math.abs(opposition - trueSkill(actor, skill)) <= w;
}

/** mark `skill` if the opposition is within MARK_WINDOW of the actor's raw or true skill (SP2) */
export function markIfClose(state: GameState, actor: Actor | undefined, skill: string, opposition: number | undefined): void {
  if (!actor || actor.id !== state.player.id || opposition === undefined) return;
  if (close(actor, skill, opposition)) mark(actor, skill);
}

/** AR5: a hit on a part your worn armor covers marks the armor skill for its weight, when the
 * attacker's skill or the armor's requirement is within MARK_WINDOW of your raw or true armor skill (either one) */
function markArmor(state: GameState, result: AttackResult): void {
  const t = actorById(state, result.targetId), a = actorById(state, result.attack.actorId);
  if (!t || !a || t.id !== state.player.id || !result.location || result.location === 'shield') return;
  const worn = t.core.inventory.find((i) => i.equippedIn?.includes('armor'));
  const def = worn && itemDef(state, worn.itemId), req = def && requirement(def);
  if (!def?.armor?.covers.includes(result.location) || !req) return;
  if (close(t, req.skill, trueSkill(a, result.attack.skill)) || close(t, req.skill, req.need)) mark(t, req.skill);
}

/** the opposition for each side of a roll: a check's target; the other side's true skill in a contest or attack */
export function markUse(state: GameState, actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult): void {
  // When a stand-in makes the roll, the stand-in AND the skill the action asked for each learn,
  // each against its own window. Without this a skill below the stand-in share of another one could never rise.
  const both = (who: Actor | undefined, r: { skill: string; asked?: string }, opp: number | undefined) => {
    markIfClose(state, who, r.skill, opp);
    if (r.asked && r.asked !== r.skill) markIfClose(state, who, r.asked, opp);
  };
  if ('target' in result) {
    for (const sk of new Set([skill, result.skill, ...(result.asked ? [result.asked] : [])])) markIfClose(state, actor, sk, result.target);
    return;
  }
  if ('a' in result) {
    const [me, them] = result.a.actorId === actor.id ? [result.a, result.b] : [result.b, result.a];
    const other = actorById(state, them.actorId);
    return both(actor, me, other ? trueSkill(other, them.skill) : undefined);
  }
  markArmor(state, result);
  const atk = result.attack, def = result.defense;
  const attacker = actorById(state, atk.actorId), defender = def ? actorById(state, def.actorId) : undefined;
  if (def && defender) {
    both(attacker, atk, trueSkill(defender, def.skill));
    if (attacker) both(defender, def, trueSkill(attacker, atk.skill));
  }
}

/** SP5: a single hit that costs ENDURANCE_MARK_PCT health or more marks endurance */
export function markEndurance(state: GameState, actor: Actor, lostPct: number): void {
  if (actor.id === state.player.id && lostPct >= CONFIG.ENDURANCE_MARK_PCT) mark(actor, SK.endurance);
}

/** improvement rolls a marked skill at `raw` gets: 1, or more from a perk's improveRolls while raw is below its limit */
function improveRolls(a: Actor, raw: number): number {
  const perks = getLibrary().perks;
  return Math.max(1, ...a.core.perks.filter((p) => !p.dormant).map((p) => perks[p.perkId]?.improveRolls).filter((r) => r && raw < r.below).map((r) => r!.rolls));
}

/** Part 1 §6, unchanged: Burden snapshot, then one improvement roll per marked skill; marks clear. Returns the gains. */
export function improveMarked(state: GameState, rng: Rng): { skill: string; from: number; to: number; milestone?: number }[] {
  const a = state.player, pr = a.progression;
  if (!pr || !pr.marks.length) return [];
  const skills = Object.values(a.core.skills);
  const total = skills.filter((s) => s.state !== 'tagged').reduce((n, s) => n + s.raw, 0);
  const potential = pr.potential.base + pr.potential.adjustments.reduce((n, x) => n + x.delta, 0);
  const burden = Math.max(0, Math.floor((total - potential) / CONFIG.K));
  const gains: { skill: string; from: number; to: number; milestone?: number }[] = [];
  for (const id of pr.marks) {
    const s = a.core.skills[id];
    if (!s || !skillOpen(a, id)) continue;
    const target = s.state === 'tagged' ? s.raw : s.raw + burden;
    for (let n = improveRolls(a, s.raw); n > 0; n--) { // Quick Study: two rolls below 15, each with its own gain
      const roll = s.state === 'flawed' ? Math.min(rng.d100(), rng.d100()) : rng.d100();
      if (!(roll > target || roll >= 99)) continue;
      const from = s.raw, trueBefore = trueSkill(a, id);
      s.raw += rng.int(1, 5);
      const crossed = MILESTONES.filter((m) => trueBefore < m && trueSkill(a, id) >= m).pop();
      gains.push({ skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) });
      state.log.push({ turn: state.turn, code: 'skill_improved', detail: { skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) } });
    }
  }
  pr.marks = [];
  return gains;
}
