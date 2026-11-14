// Part 1 §6 skill improvement ("Skill progression: options" SP1–SP11).
// A use marks a skill when the opposition is from MARK_WINDOW below its raw skill to MARK_WINDOW above its true skill (SP2, SP6); a hit that
// costs ENDURANCE_MARK_PCT health or more marks endurance (SP5); a hit your armor covers can mark its armor skill (AR5). Marked skills roll at the end of the
// scenario (EG7, engine/growth.ts payScenario), in rounds (payRolls). Only the player keeps marks for now (SP7). Failed improvement rolls show nothing (SP11).
import type { Actor, AttackResult, CheckResult, ContestResult, AugmentWhen, GameState, RollKind, Rng, SkillEntry } from '../types';
import { TIERS } from '../scales';
import { band, extraBands, naturalEdge } from './index';
import { tierReach } from './achRewards';
import { CONFIG } from '../config';
import { actorById } from '../engine/relations';
import { hasPerk, milestonesUpTo, trueSkill } from './perks';
import { skillCap } from './skillCap';
import { skillOpen } from './access';
import { getLibrary, itemDef } from '../library';
import { requirement } from './requirements';
import { augmentFactors, augmentsOf, tradesOut } from './gear';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { isEcho } from '../library/echo';
import { wornArmor } from './slots';

function mark(actor: Actor, skill: string): void {
  const pr = actor.progression;
  // a skill not on the sheet learns from use too: it counts as raw 0 and joins the sheet with its first gain
  if (!pr || !getLibrary().skills[skill] || !skillOpen(actor, skill)) return; // a closed tree can't be raised (TA4)
  if (isEcho(actor)) return; // D-243: an echo never learns
  // SM1: marks stack. The first mark this engagement owes a roll, and every MARK_STACK_EVERY-th mark after it owes another
  const counts = (pr.markCounts ??= {});
  const n = (counts[skill] = (counts[skill] ?? 0) + 1);
  if (n === 1 || (n - 1) % CONFIG.MARK_STACK_EVERY === 0) pr.marks.push(skill);
}

/** SM1/SM3: the engagement (or, outside one, the scenario) is over: mark counts start again */
export function clearMarkCounts(actor: Actor): void {
  if (actor.progression) actor.progression.markCounts = {};
}

/** SP2: does `opposition` teach this skill? From MARK_WINDOW below raw skill up to MARK_WINDOW above true skill; a won
 * contest or a passed check has no top (beating something stronger teaches, PG2). A skill not on the sheet counts as raw 0. */
function close(actor: Actor, skill: string, opposition: number, won = false): boolean {
  return inWindow(learningWindow(actor.core.skills[skill]?.raw ?? 0, trueSkill(actor, skill)), opposition, won);
}
/** the opposition is inside a learning window; a won contest has no top */
const inWindow = ([lo, hi]: [number, number], opposition: number, won: boolean): boolean => opposition >= lo && (won || opposition <= hi);
/** SP2: the opposition range that teaches a skill at `raw` and `trueValue`: raw − MARK_WINDOW to max(raw, true) + MARK_WINDOW */
export const learningWindow = (raw: number, trueValue: number): [number, number] => [raw - CONFIG.MARK_WINDOW, Math.max(raw, trueValue) + CONFIG.MARK_WINDOW];

/** mark `skill` if the opposition is inside its learning window (SP2: raw − MARK_WINDOW to true + MARK_WINDOW) */
export function markIfClose(state: GameState, actor: Actor | undefined, skill: string, opposition: number | undefined, tied = false, won = false): void {
  if (!actor || actor.id !== state.player.id || opposition === undefined) return;
  if (tied || close(actor, skill, opposition, won)) mark(actor, skill); // close calls teach: a tier gap of exactly 0 marks whatever the skills
}

/** a side's level on a roll for augment learning: its true skill plus what its augments added (AU2) */
const rollLevel = (actor: Actor, r: { skill: string; asked?: string; rollKind?: RollKind; when?: AugmentWhen[] }) =>
  trueSkill(actor, r.skill) + [...augmentsOf(actor, r.asked ?? r.skill, r.rollKind, r.when), ...tradesOut(actor, r.skill)].reduce((n, a) => n + a.value, 0);
/** the learning window of a roll of `skill` with these augments (AU1 option B): raw sums to max(raw, true) sums, each augment at share × tier */
function rollWindow(actor: Actor, skill: string, augs: { id: string; k: number }[]): [number, number] {
  const raw = (id: string) => actor.core.skills[id]?.raw ?? 0, top = (id: string) => Math.max(raw(id), trueSkill(actor, id));
  return learningWindow(raw(skill) + augs.reduce((n, a) => n + raw(a.id) * a.k, 0), top(skill) + augs.reduce((n, a) => n + top(a.id) * a.k, 0));
}
/** the window an augmenting skill learns in: that of the roll it adds to (its first augments entry), for the sheet.
 * null for a skill that augments nothing. */
export function augmentWindow(actor: Actor, skill: string): { via: string; window: [number, number] } | null {
  const g = getLibrary().skills[skill]?.augments?.[0];
  if (!g) return null;
  return { via: g.skill, window: rollWindow(actor, g.skill, augmentFactors(actor, g.skill, g.rollKinds?.[0])) };
}
/** Augmenting skills learn at the level the roll was made at (AU1 option B): one window for the whole roll, built like any
 * skill's window from the roll's sums. Low end: the rolled skill's raw + each augment's raw × share × tier. High end: the
 * rolled skill's max(raw, true) + each augment's max(raw, true) × share × tier. Every augment that added to the roll marks
 * when the opposition (the other side's level, augments included) is inside it, or on a close call (AU4). */
function markAugments(state: GameState, actor: Actor | undefined, r: { skill: string; asked?: string; rollKind?: RollKind; when?: AugmentWhen[] }, opposition: number | undefined, force = false, won = false): void {
  if (!actor || actor.id !== state.player.id || opposition === undefined) return;
  const augs = augmentFactors(actor, r.asked ?? r.skill, r.rollKind, r.when); // on the sheet or not: an augment at 0 learns once its tree opens
  if (!augs.length) return;
  if (force || inWindow(rollWindow(actor, r.skill, augs), opposition, won)) for (const a of augs) mark(actor, a.id);
}

/** AR5: a hit on a part your worn armor covers marks the armor skill for its weight, when the
 * attacker's skill or the armor's requirement is inside your armor skill's learning window (SP2) */
function markArmor(state: GameState, result: AttackResult): void {
  const t = actorById(state, result.targetId), a = actorById(state, result.attack.actorId);
  if (!t || !a || t.id !== state.player.id || !result.location || result.location === 'shield') return;
  const worn = wornArmor(t.core.inventory);
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
  const both = (who: Actor | undefined, r: { skill: string; asked?: string; parts?: string[]; rollKind?: RollKind; when?: AugmentWhen[] }, opp: number | undefined, side: 1 | -1, augOpp?: number) => {
    const force = tied || near(who, side);
    // a win has no top to its window: beating a stronger side teaches. Side A wins at gap < 0, side B at gap > 0.
    const won = 'gap' in result && (result.gap ?? 0) * side < 0;
    markAugments(state, who, r, augOpp, force, won); // skills that augmented the roll learn at the roll's level
    markIfClose(state, who, r.skill, opp, force, won);
    if (r.asked && r.asked !== r.skill) markIfClose(state, who, r.asked, opp, force); // the stand-in won, not the asked skill: its window holds
    for (const p of r.parts ?? []) if (p !== r.skill) markIfClose(state, who, p, opp, force, won); // a combined roll: every part learns
  };
  if ('target' in result) {
    // PG2: a passed check has no top to its window, like a won contest (the stand-in's asked skill keeps its window)
    for (const sk of new Set([skill, result.skill, ...(result.asked ? [result.asked] : [])])) markIfClose(state, actor, sk, result.target, false, result.passed && sk !== result.asked);
    markAugments(state, actor, result, result.target, false, result.passed);
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

/** FT27: the player's Stamina is marked once per STAMINA_MARK_EVERY points of strain paid, any effort (no rolls) */
export function markStamina(state: GameState, actor: Actor): void {
  if (actor.id === state.player.id) mark(actor, SK.stamina);
}

export { skillCap } from './skillCap';

/** SG1 C: one improvement roll. margin = d100 + (cap − raw − burden) − GROWTH_ROLL_NEEDED, read on the tier table; the
 * gain is GROWTH_GAIN by tier, plus GROWTH_GAIN_PAST_CRIT per band past Critical Success. Every state rolls one d100: a
 * tag or a flaw only moves the cap. The room left below the cap is the bonus, so the roll gets harder smoothly near the
 * cap. A tagged skill carries no burden. SG3 a (GROWTH_CAP_IN_ROLL): the room counts from the skill's own cap. */
export function growthRoll(d: number, s: Pick<SkillEntry, 'raw' | 'state'>, burden: number, reach = { up: 0, down: 0 }): { margin: number; level: number; gain: number } {
  const cap = CONFIG.GROWTH_CAP_IN_ROLL ? skillCap(s) : CONFIG.SKILL_CAP;
  const margin = d + (cap - s.raw - (s.state === 'tagged' ? 0 : burden)) - CONFIG.GROWTH_ROLL_NEEDED;
  const level = band(margin) + extraBands(margin, reach) + (CONFIG.GROWTH_NATURAL_EDGES ? naturalEdge(d) : 0);
  const crit = TIERS.pos('critical_success');
  const gain = level < TIERS.pos('success') ? 0
    : level > crit ? (CONFIG.GROWTH_GAIN.critical_success ?? 0) + (level - crit) * CONFIG.GROWTH_GAIN_PAST_CRIT
    : CONFIG.GROWTH_GAIN[TIERS.at(level)] ?? 0;
  return { margin, level, gain: Math.max(0, Math.min(gain, skillCap(s) - s.raw)) }; // raw never passes its cap
}

/** improvement rolls a marked skill at `raw` gets: 1, or more from a perk's improveRolls while raw is below its limit */
function improveRolls(a: Actor, raw: number): number {
  const perks = getLibrary().perks;
  return Math.max(1, ...a.core.perks.filter((p) => !p.dormant).map((p) => perks[p.perkId]?.improveRolls).filter((r) => r && raw < r.below).map((r) => r!.rolls));
}

export type SkillGain = { skill: string; from: number; to: number; milestone?: number };

/** Part 1 §6: the raw total of every untagged skill (flawed ones count), and the Potential Burden starts from */
export function burdenParts(a: Actor): { total: number; potential: number } {
  const pr = a.progression!;
  const total = Object.values(a.core.skills).filter((s) => s.state !== 'tagged').reduce((n, s) => n + s.raw, 0);
  return { total, potential: pr.potential.base + pr.potential.adjustments.reduce((n, x) => n + x.delta, 0) };
}

/** Part 1 §6 Burden: how far the untagged raw total is over Potential, in steps of K */
export function burdenOf(a: Actor): number {
  const { total, potential } = burdenParts(a);
  return Math.max(0, Math.floor((total - potential) / CONFIG.K));
}

/** Pays improvement rolls to the player's skills in rounds (growth proposal, the rounds rule): each round every skill with
 * rolls left makes one, against a Burden worked out fresh at the start of the round, so the first round's gains weigh on the
 * second. `rolls` lists [skill, rolls] in dealing order. Returns the gains. */
export function payRolls(state: GameState, rng: Rng, rolls: [string, number][]): SkillGain[] {
  const a = state.player;
  const left = new Map(rolls.filter(([id, n]) => n > 0 && getLibrary().skills[id] && skillOpen(a, id)));
  const gains: SkillGain[] = [];
  const reach = tierReach(a, undefined); // only tier unlocks for 'any' roll reach past Critical Success
  while (left.size) {
    const burden = burdenOf(a);
    for (const [id, n] of [...left]) {
      if (n <= 1) left.delete(id); else left.set(id, n - 1);
      const s = a.core.skills[id] ?? { raw: 0, state: 'normal' as const }; // not on the sheet yet: it joins with its first gain
      for (let k = improveRolls(a, s.raw); k > 0; k--) { // Quick Study: two rolls below 15, each with its own gain
        const { gain } = growthRoll(rng.d100(), s, burden, reach); // one d100 for every state: a flaw only lowers the cap
        if (!gain) continue;
        const from = s.raw, trueBefore = trueSkill(a, id);
        s.raw += gain;
        a.core.skills[id] = s;
        const crossed = milestonesUpTo(trueSkill(a, id)).filter((m) => trueBefore < m).pop();
        gains.push({ skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) });
        state.log.push({ turn: state.turn, code: 'skill_improved', detail: { skill: id, from, to: s.raw, ...(crossed ? { milestone: crossed } : {}) } });
      }
    }
  }
  return gains;
}

/** the player's owed rolls by skill, in the order first marked */
export function owedBySkill(actor: Actor): [string, number][] {
  const m = new Map<string, number>();
  for (const id of actor.progression?.marks ?? []) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m];
}

/** Part 1 §6 without scenario-end growth (CONFIG.GROWTH_AT_SCENARIO_END off): every owed roll is made now, in rounds; marks clear.
 * Mark counts are kept: clearMarkCounts clears them when the engagement or scenario ends. */
export function improveMarked(state: GameState, rng: Rng): SkillGain[] {
  const pr = state.player.progression;
  if (!pr || !pr.marks.length) return [];
  const gains = payRolls(state, rng, owedBySkill(state.player));
  pr.marks = [];
  return gains;
}
