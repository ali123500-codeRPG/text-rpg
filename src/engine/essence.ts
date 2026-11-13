// Essences (growth proposal section 2; EG1 a, EG2, EG3 b, EG4 a, EG9 a, EG11 b, EG15 b). A beaten notable foe, or a scenario
// resolved at Great Success or better, may have an essence appear (the appearance roll); its quality roll then sets its grade,
// or it fades. A held one is an offer: a package of true skill (and later a trait) the player can take
// into a limited number of slots. Code rolls every offer from tables; no agent names, seeds or changes one.
import type { Actor, EssenceDef, EssenceOffer, GameState, HeldEssence, Rng, ScenarioEnding, ScenarioFrame } from '../types';
import { CONFIG } from '../config';
import { getLibrary, npcTemplate } from '../library';
import { ESSENCE_GRADES, TIERS, type EssenceGradeKey } from '../scales';
import { band, naturalEdge } from '../ruleset';
import { trueSkill } from '../ruleset/perks';
import { tierMult } from '../ruleset/gear';
import { charLevel, power, tally, xpToNext } from './xp';
import { logCode } from './effects';
import { isEngaged } from './relations';
import { threatHere } from './resolve';
import { dealRolls } from './growth';
import { fireEssenceAuto } from '../ruleset/threadboundItems';

/** EG2: how many essences the player can hold: ESSENCE_SLOTS_BASE + one per ESSENCE_SLOT_EVERY character levels, no top */
export const essenceSlots = (a: Actor): number => CONFIG.ESSENCE_SLOTS_BASE + Math.floor(charLevel(a) / CONFIG.ESSENCE_SLOT_EVERY);

/** a grade's multiplier: its row, or past the last row the last one × ESSENCE_GRADE_PAST_MULT per step */
export function gradeMult(grade: EssenceGradeKey, past = 0): number {
  return (CONFIG.ESSENCE_GRADE_MULT[grade] ?? 1) * CONFIG.ESSENCE_GRADE_PAST_MULT ** past;
}

/** the appearance roll: does an essence appear at all? d100 ≤ ESSENCE_APPEAR_CHANCE for the source. Nothing (no item ability)
 * touches it: the Threadbound item actives work on the quality roll only. */
export const appearRoll = (rng: Rng, source: string): boolean => rng.d100() <= (CONFIG.ESSENCE_APPEAR_CHANCE[source] ?? 0);

/** the quality roll (2.4), made once an essence has appeared: d100 + base − ESSENCE_ROLL_NEEDED on the tier table, natural
 * edges included. Near Miss or worse: the essence fades; Success common, Great Success fine, Critical Success rare; returns the
 * grade and steps past the last grade. `by` (the player): a ready Threadbound item ability fires by itself (D-218: Call the
 * Toss, All or Nothing), on this roll only. */
export function qualityRoll(rng: Rng, base: number, by?: { state: GameState; actor: Actor }): { grade: EssenceGradeKey; past: number } | null {
  const auto = by && fireEssenceAuto(by.state, by.actor);
  let d = rng.d100();
  if (auto?.kind === 'farther') { const d2 = rng.d100(); if (Math.abs(d2 - 50.5) > Math.abs(d - 50.5)) d = d2; }
  if (auto) logCode(by!.state, 'essence_roll_auto', { perk: auto.perk, roll: d });
  const top = TIERS.keys.length - 1;
  const at = auto?.kind === 'all_or_nothing' ? (d >= 51 ? top : 0) : band(d + base - CONFIG.ESSENCE_ROLL_NEEDED);
  const level = Math.max(0, Math.min(top, at + naturalEdge(d)));
  const step = level - TIERS.pos('success');
  if (step < 0) return null;
  const last = ESSENCE_GRADES.keys.length - 1;
  return { grade: ESSENCE_GRADES.keys[Math.min(step, last)], past: Math.max(0, step - last) };
}

/** an essence appears from `row` (logged: the Narrator tells it), then its quality roll decides: held as an offer, or it fades */
function appearAndRoll(state: GameState, rng: Rng, row: EssenceDef, base: number, source: EssenceOffer['source'], from: string,
  skills: { skill: string; weight: number }[], measure: (skill: string) => number): void {
  logCode(state, 'essence_appeared', { essence: row.id, source, from });
  const roll = qualityRoll(rng, base, { state, actor: state.player });
  if (roll) return offer(state, row, skills, roll, source, from, measure);
  logCode(state, 'essence_faded', { essence: row.id, source, from });
}

/** EG9 a: the rows a source offers, picked by weight (the kind is fixed by the source; chance only decides if and how good) */
function pick(rows: EssenceDef[], rng: Rng): EssenceDef | undefined {
  const total = rows.reduce((n, r) => n + r.weight, 0);
  let x = rng.next() * total;
  for (const r of rows) { x -= r.weight; if (x < 0) return r; }
  return rows[rows.length - 1];
}
const rowsFor = (state: GameState, who: Actor): EssenceDef[] => {
  const race = who.core.raceId, body = who.core.bodyTypeId;
  return Object.values(getLibrary().essences ?? {}).filter((r) => (r.from.race && r.from.race === race) || (r.from.bodyType && r.from.bodyType === body));
};

/** 2.2: points = max(1, round(ESSENCE_SHARE × source skill × grade multiplier)), split over the row's skills by weight.
 * `source` gives the skill each point is measured from (a foe's raw × tier, or the player's own true skill). */
function points(row: EssenceDef, skills: { skill: string; weight: number }[], grade: EssenceGradeKey, past: number, source: (skill: string) => number): Record<string, number> {
  const w = skills.reduce((n, s) => n + s.weight, 0) || 1;
  const at = skills.reduce((n, s) => n + source(s.skill) * s.weight, 0) / w;
  const total = Math.max(1, Math.round(CONFIG.ESSENCE_SHARE * at * gradeMult(grade, past)));
  return Object.fromEntries(dealRolls(skills.map((s) => [s.skill, s.weight]), total));
}

function offer(state: GameState, row: EssenceDef, skills: { skill: string; weight: number }[], roll: { grade: EssenceGradeKey; past: number },
  source: EssenceOffer['source'], from: string, measure: (skill: string) => number): void {
  const pr = state.player.progression;
  if (!pr || !skills.length) return;
  const o: EssenceOffer = { essence: row.id, grade: roll.grade, points: points(row, skills, roll.grade, roll.past, measure), turn: state.turn, from, source, until: state.turn + CONFIG.ESSENCE_OFFER_TURNS };
  (pr.essenceOffers ??= []).push(o);
  logCode(state, 'essence_offered', { essence: row.id, grade: roll.grade, source, from });
}

/** 2.3: a beaten foe is notable when its power is at least ESSENCE_NOTABLE_SHARE of the player's, or its template is notable or unique */
export function notable(state: GameState, foe: Actor): boolean {
  const id = foe.core.templateId, t = id ? (() => { try { return npcTemplate(state, id); } catch { return undefined; } })() : undefined;
  return !!t?.notable || foe.core.generation === 'unique' || power(state, foe) >= CONFIG.ESSENCE_NOTABLE_SHARE * power(state, state.player);
}

/** 2.3: each foe the player beat this turn (payDefeats) rolls once, ever, for an essence of its race or body type, if notable.
 * The foes go on the running scenario's list (its ending's table). */
export function offersFromDefeats(state: GameState, defeated: Actor[], rng: Rng): void {
  for (const foe of defeated) {
    const f = state.stage.scenario;
    if (f) (f.beaten ??= []).push(foe.id);
    if (!foe.mind || foe.mind.essenceRolled || !notable(state, foe)) continue;
    foe.mind.essenceRolled = true;
    const rows = rowsFor(state, foe);
    if (!rows.length || !appearRoll(rng, 'foe')) continue;
    const row = pick(rows, rng)!;
    appearAndRoll(state, rng, row, CONFIG.ESSENCE_ROLL_BASE.foe, 'foe', foe.names.current, row.skills, (sk) => (foe.core.skills[sk]?.raw ?? 0) * tierMult(sk));
  }
}

/** 2.3: a scenario resolved at Great Success or better may offer: from the foes beaten in it, or with none a deed essence on the
 * skill the player marked most (`owed`: its owed rolls by skill, before the payout) */
export function offerAtEnding(state: GameState, f: ScenarioFrame, as: ScenarioEnding, rng: Rng, owed: [string, number][]): void {
  const base = CONFIG.ESSENCE_ROLL_BASE[f.tier];
  if (as !== 'resolved' || base === undefined) return;
  const foes = (f.beaten ?? []).map((id) => state.actors.find((a) => a.id === id)).filter((a): a is Actor => !!a);
  const rows = [...new Set(foes.flatMap((x) => rowsFor(state, x)))];
  const deed = Object.values(getLibrary().essences ?? {}).filter((r) => r.from.deed);
  if (!appearRoll(rng, f.tier)) return;
  const p = state.player;
  if (rows.length) { const row = pick(rows, rng)!; return appearAndRoll(state, rng, row, base, 'ending', 'ending', row.skills, (sk) => trueSkill(p, sk)); }
  const top = [...owed].sort((a, b) => b[1] - a[1])[0];
  const row = top && pick(deed, rng);
  if (row) appearAndRoll(state, rng, row, base, 'ending', 'ending', [{ skill: top[0], weight: 1 }], (sk) => trueSkill(p, sk));
}

/** offers past their last turn lapse; `before` (a new scenario's start) also drops every offer made on an earlier turn */
export function expireOffers(state: GameState, newScenario = false): void {
  const pr = state.player.progression;
  if (!pr?.essenceOffers) return;
  pr.essenceOffers = pr.essenceOffers.filter((o) => state.turn <= o.until && (!newScenario || o.turn >= state.turn));
  if (!pr.essenceOffers.length) delete pr.essenceOffers;
}

/** EG3 b: removal and swaps happen at rest: out of any fight, with no hostile in the zone (what a rest needs) */
export const playerAtRest = (state: GameState): boolean => !isEngaged(state, state.player) && !threatHere(state, state.player);

/** EG3 b + EG15 b: give up a held essence (lost for good): costs ESSENCE_REMOVE_LEVELS × the current level's XP, into debt if
 * need be. Returns an error message, or null when done. */
export function removeEssence(state: GameState, index: number, atRest: boolean): string | null {
  const pr = state.player.progression, held = pr?.essences ?? [];
  if (!pr || !held[index]) return 'There is no such essence.';
  if (!atRest) return 'You can only let an essence go at rest: out of any fight, with no one hostile nearby.';
  const [e] = held.splice(index, 1);
  const cost = CONFIG.ESSENCE_REMOVE_LEVELS * xpToNext(state.player);
  pr.xp -= cost;
  (pr.xpLog ??= []).push({ source: `essence removed:${e.essence}`, amount: -cost, turn: state.turn });
  if (!held.length) delete pr.essences;
  logCode(state, 'essence_removed', { essence: e.essence, cost });
  return null;
}

/** 2.5: take an offer into an empty slot; with every slot full, `replace` names the held essence to give up (removal rules) */
export function takeEssence(state: GameState, offerIndex: number, atRest: boolean, replace?: number): string | null {
  const p = state.player, pr = p.progression, o = pr?.essenceOffers?.[offerIndex];
  if (!pr || !o) return 'There is no such offer.';
  const held = (pr.essences ??= []);
  if (held.length >= essenceSlots(p)) {
    if (replace === undefined) { if (!held.length) delete pr.essences; return `You have no room: every one of your ${essenceSlots(p)} slots is full. Name one to give up.`; }
    const err = removeEssence(state, replace, atRest);
    if (err) return err;
  }
  pr.essenceOffers!.splice(offerIndex, 1);
  if (!pr.essenceOffers!.length) delete pr.essenceOffers;
  const { source: _s, until: _u, ...e } = o;
  (pr.essences ??= []).push({ ...e, turn: state.turn } as HeldEssence);
  logCode(state, 'essence_taken', { essence: o.essence, grade: o.grade });
  tally(state, 'essences_taken');
  if (pr.essences!.length >= essenceSlots(p)) tally(state, 'essence_room', { to: charLevel(p) });
  return null;
}

/** 2.5: let an offer go for good */
export function passEssence(state: GameState, offerIndex: number): string | null {
  const pr = state.player.progression, o = pr?.essenceOffers?.[offerIndex];
  if (!pr || !o) return 'There is no such offer.';
  pr.essenceOffers!.splice(offerIndex, 1);
  if (!pr.essenceOffers!.length) delete pr.essenceOffers;
  logCode(state, 'essence_declined', { essence: o.essence });
  return null;
}

/** an essence's name and its points, as the sheet and /essence show them */
export function essenceText(e: HeldEssence, skillName: (id: string) => string): string {
  const row = getLibrary().essences?.[e.essence];
  return `${row?.name ?? e.essence} (${ESSENCE_GRADES.name(e.grade)}): ${Object.entries(e.points).map(([k, v]) => `${skillName(k)} +${v}`).join(', ')}`;
}
