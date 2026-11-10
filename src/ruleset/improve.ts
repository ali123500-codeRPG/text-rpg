// Part 1 §6 skill improvement ("Skill progression: options" SP1–SP11).
// A use marks a skill when the opposition is from MARK_WINDOW below its raw skill to MARK_WINDOW above its true skill (SP2, SP6); a hit that
// costs ENDURANCE_MARK_PCT health or more marks endurance (SP5); a hit your armor covers can mark its armor skill (AR5). Marked skills roll at the end of each engagement or
// when the scene breaks (SP3). Only the player keeps marks for now (SP7). Failed improvement rolls show nothing (SP11).
import type { Actor, AttackResult, CheckResult, ContestResult, GameState, RollKind, Rng } from '../types';
import { CONFIG } from '../config';
import { actorById } from '../engine/relations';
import { MILESTONES, hasPerk, trueSkill } from './perks';
import { skillOpen } from './access';
import { getLibrary, itemDef } from '../library';
import { requirement } from './requirements';
import { augmentsOf, perkAugments, tierMult } from './gear';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';

function mark(actor: Actor, skill: string): void {
  const pr = actor.progression;
  // a skill not on the sheet learns from use too: it counts as raw 0 and joins the sheet with its first gain
  if (pr && getLibrary().skills[skill] && skillOpen(actor, skill) && !pr.marks.includes(skill)) pr.marks.push(skill); // a closed tree can't be raised (TA4)
}

/** SP2: does `opposition` teach this skill? From MARK_WINDOW below raw skill up to MARK_WINDOW above true skill.
 * A skill not on the sheet counts as raw 0. */
function close(actor: Actor, skill: string, opposition: number): boolean {
  const [lo, hi] = learningWindow(actor.core.skills[skill]?.raw ?? 0, trueSkill(actor, skill));
  return opposition >= lo && opposition <= hi;
}
/** SP2: the opposition range that teaches a skill at `raw` and `trueValue`: raw − MARK_WINDOW to max(raw, true) + MARK_WINDOW */
export const learningWindow = (raw: number, trueValue: number): [number, number] => [raw - CONFIG.MARK_WINDOW, Math.max(raw, trueValue) + CONFIG.MARK_WINDOW];

/** mark `skill` if the opposition is inside its learning window (SP2: raw − MARK_WINDOW to true + MARK_WINDOW) */
export function markIfClose(state: GameState, actor: Actor | undefined, skill: string, opposition: number | undefined, tied = false): void {
  if (!actor || actor.id !== state.player.id || opposition === undefined) return;
  if (tied || close(actor, skill, opposition)) mark(actor, skill); // close calls teach: a tier gap of exactly 0 marks whatever the skills
}

/** the skills that augment `skill` on a roll of this kind (SkillDef.augments), each with its share × tier. On the sheet or
 * not: an augment at 0 can learn once its tree opens. */
function augmenters(actor: Actor, skill: string, rollKind?: RollKind): { id: string; k: number }[] {
  const out: { id: string; k: number }[] = [];
  for (const d of Object.values(getLibrary().skills)) for (const g of d.augments ?? []) {
    if (g.skill !== skill || (g.rollKinds && (!rollKind || !g.rollKinds.includes(rollKind))) || !skillOpen(actor, d.id) || actor.core.skills[d.id]?.dormant) continue;
    out.push({ id: d.id, k: (g.share ?? 1) * tierMult(d.id) });
  }
  for (const g of perkAugments(actor, skill, rollKind)) out.push({ id: g.from, k: (g.share ?? 1) * tierMult(g.from) }); // All-50 Grit
  return out;
}
/** a side's level on a roll for augment learning: its true skill plus what its augments added (AU2) */
const rollLevel = (actor: Actor, r: { skill: string; asked?: string; rollKind?: RollKind }) =>
  trueSkill(actor, r.skill) + augmentsOf(actor, r.asked ?? r.skill, r.rollKind).reduce((n, a) => n + a.value, 0);
/** Augmenting skills learn at the level the roll was made at (AU1 option B): one window for the whole roll, built like any
 * skill's window from the roll's sums. Low end: the rolled skill's raw + each augment's raw × share × tier. High end: the
 * rolled skill's max(raw, true) + each augment's max(raw, true) × share × tier. Every augment that added to the roll marks
 * when the opposition (the other side's level, augments included) is inside it, or on a close call (AU4). */
function markAugments(state: GameState, actor: Actor | undefined, r: { skill: string; asked?: string; rollKind?: RollKind }, opposition: number | undefined, force = false): void {
  if (!actor || actor.id !== state.player.id || opposition === undefined) return;
  const augs = augmenters(actor, r.asked ?? r.skill, r.rollKind);
  if (!augs.length) return;
  const raw = (id: string) => actor.core.skills[id]?.raw ?? 0, top = (id: string) => Math.max(raw(id), trueSkill(actor, id));
  const [lo, hi] = learningWindow(raw(r.skill) + augs.reduce((n, a) => n + raw(a.id) * a.k, 0), top(r.skill) + augs.reduce((n, a) => n + top(a.id) * a.k, 0));
  if (force || (opposition >= lo && opposition <= hi)) for (const a of augs) mark(actor, a.id);
}

/** AR5: a hit on a part your worn armor covers marks the armor skill for its weight, when the
 * attacker's skill or the armor's requirement is inside your armor skill's learning window (SP2) */
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
  // a contest or defended attack whose tier gap is exactly 0 marks both sides' skills, inside the window or not
  const tied = 'gap' in result && result.gap === 0;
  // Every Fall a Lesson: losing by exactly one tier step marks too. The gap is B − A in a contest and defense − attack in
  // an attack, so side A (the attacker) loses by one at gap +1 and side B (the defender) at gap −1.
  const near = (who: Actor | undefined, side: 1 | -1) => 'gap' in result && result.gap === side && hasPerk(who, PK.every_fall_a_lesson);
  const both = (who: Actor | undefined, r: { skill: string; asked?: string; parts?: string[]; rollKind?: RollKind }, opp: number | undefined, side: 1 | -1, augOpp?: number) => {
    const force = tied || near(who, side);
    markAugments(state, who, r, augOpp, force); // skills that augmented the roll learn at the roll's level
    markIfClose(state, who, r.skill, opp, force);
    if (r.asked && r.asked !== r.skill) markIfClose(state, who, r.asked, opp, force);
    for (const p of r.parts ?? []) if (p !== r.skill) markIfClose(state, who, p, opp, force); // a combined roll: every part learns
  };
  if ('target' in result) {
    for (const sk of new Set([skill, result.skill, ...(result.asked ? [result.asked] : [])])) markIfClose(state, actor, sk, result.target);
    markAugments(state, actor, result, result.target);
    return;
  }
  if ('a' in result) {
    const [me, them, side] = result.a.actorId === actor.id ? [result.a, result.b, 1 as const] : [result.b, result.a, -1 as const];
    const other = actorById(state, them.actorId);
    return both(actor, me, other ? trueSkill(other, them.skill) : undefined, side, other ? rollLevel(other, them) : undefined);
  }
  markArmor(state, result);
  const atk = result.attack, def = result.defense;
  const attacker = actorById(state, atk.actorId), defender = def ? actorById(state, def.actorId) : undefined;
  if (def && defender) {
    both(attacker, atk, trueSkill(defender, def.skill), 1, rollLevel(defender, def));
    if (attacker) both(defender, def, trueSkill(attacker, atk.skill), -1, rollLevel(attacker, atk));
  }
}

/** SP5: a single hit that costs ENDURANCE_MARK_PCT health or more marks endurance */
export function markEndurance(state: GameState, actor: Actor, lostPct: number): void {
  if (actor.id === state.player.id && lostPct >= CONFIG.ENDURANCE_MARK_PCT) mark(actor, SK.endurance);
}

/** a single morale loss of RESOLVE_MARK_PCT % of max morale or more marks the player's Resolve (like Endurance) */
export function markResolve(state: GameState, actor: Actor, lostPct: number): void {
  if (actor.id === state.player.id && lostPct >= CONFIG.RESOLVE_MARK_PCT) mark(actor, SK.resolve);
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
    if (!getLibrary().skills[id] || !skillOpen(a, id)) continue;
    const s = a.core.skills[id] ?? { raw: 0, state: 'normal' as const }; // not on the sheet yet: it joins with its first gain
    const target = s.state === 'tagged' ? s.raw : s.raw + burden;
    for (let n = improveRolls(a, s.raw); n > 0; n--) { // Quick Study: two rolls below 15, each with its own gain
      const roll = s.state === 'flawed' ? Math.min(rng.d100(), rng.d100()) : rng.d100();
      if (!(roll > target || roll >= 99)) continue;
      const from = s.raw, trueBefore = trueSkill(a, id);
      s.raw += rng.int(1, 5);
      a.core.skills[id] = s;
      const crossed = MILESTONES.filter((m) => trueBefore < m && trueSkill(a, id) >= m).pop();
      gains.push({ skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) });
      state.log.push({ turn: state.turn, code: 'skill_improved', detail: { skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) } });
    }
  }
  pr.marks = [];
  return gains;
}
