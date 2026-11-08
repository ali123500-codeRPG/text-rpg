// Part 1 §6 skill improvement (Ali, 07/11/2026, "Skill progression: options" SP1–SP11).
// A use marks a skill when the opposition is within MARK_WINDOW of the user's raw or true skill (SP2, SP6); a hit that
// costs ENDURANCE_MARK_PCT health or more marks endurance (SP5). Marked skills roll at the end of each engagement or
// when the scene breaks (SP3). Only the player keeps marks for now (SP7). Failed improvement rolls show nothing (SP11).
import type { Actor, AttackResult, CheckResult, ContestResult, GameState, Rng } from '../types';
import { CONFIG } from '../config';
import { actorById } from '../engine/relations';
import { MILESTONES, trueSkill } from './perks';
import { skillOpen } from './access';

function mark(actor: Actor, skill: string): void {
  const pr = actor.progression;
  if (pr && actor.core.skills[skill] && skillOpen(actor, skill) && !pr.marks.includes(skill)) pr.marks.push(skill); // a closed tree can't be raised (TA4)
}

/** mark `skill` if the opposition is within MARK_WINDOW of the actor's raw or true skill (SP2) */
export function markIfClose(state: GameState, actor: Actor | undefined, skill: string, opposition: number | undefined): void {
  if (!actor || actor.id !== state.player.id || opposition === undefined) return;
  const raw = actor.core.skills[skill]?.raw;
  if (raw === undefined) return;
  const w = CONFIG.MARK_WINDOW;
  if (Math.abs(opposition - raw) <= w || Math.abs(opposition - trueSkill(actor, skill)) <= w) mark(actor, skill);
}

/** the opposition for each side of a roll: a check's target; the other side's true skill in a contest or attack */
export function markUse(state: GameState, actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult): void {
  if ('target' in result) return markIfClose(state, actor, skill, result.target);
  if ('a' in result) {
    const [me, them] = result.a.actorId === actor.id ? [result.a, result.b] : [result.b, result.a];
    const other = actorById(state, them.actorId);
    return markIfClose(state, actor, me.skill, other ? trueSkill(other, them.skill) : undefined);
  }
  const atk = result.attack, def = result.defense;
  const attacker = actorById(state, atk.actorId), defender = def ? actorById(state, def.actorId) : undefined;
  if (def && defender) {
    markIfClose(state, attacker, atk.skill, trueSkill(defender, def.skill));
    if (attacker) markIfClose(state, defender, def.skill, trueSkill(attacker, atk.skill));
  }
}

/** SP5: a single hit that costs ENDURANCE_MARK_PCT health or more marks endurance */
export function markEndurance(state: GameState, actor: Actor, lostPct: number): void {
  if (actor.id === state.player.id && lostPct >= CONFIG.ENDURANCE_MARK_PCT) mark(actor, 'endurance');
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
    const roll = s.state === 'flawed' ? Math.min(rng.d100(), rng.d100()) : rng.d100();
    if (!(roll > target || roll >= 99)) continue;
    const from = s.raw, trueBefore = trueSkill(a, id);
    s.raw += rng.int(1, 5);
    const crossed = MILESTONES.filter((m) => trueBefore < m && trueSkill(a, id) >= m).pop();
    gains.push({ skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) });
    state.log.push({ turn: state.turn, code: 'skill_improved', detail: { skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) } });
  }
  pr.marks = [];
  return gains;
}
