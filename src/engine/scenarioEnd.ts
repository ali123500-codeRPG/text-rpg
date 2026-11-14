// Scenarios as situations (SC1–SC10): a scenario's hidden question, scale and endings; code checks the endings every turn,
// holds one met mid-fight, mid-chase or mid-talk (SC13), and keeps a record of how each scenario went (SC6). An Episode or
// Venture holds smaller scenarios one level deep (SC4): a road encounter inside one starts an inner scenario, and when that ends
// the bigger scenario carries on with no new event roll and no Weaver call.
import type { CheckinAnswer, CheckinReason, EndCheck, GameEvent, GameState, Grade, PlanEnding, Rng, ScenarioEnding, ScenarioFrame, ScenarioRecord, StagePlan, Tier } from '../types';
import { PLAN_ENDINGS } from '../types';
import { createRng } from '../rng';
import { CONFIG } from '../config';
import { SCENARIO_SCALES, TIME_OF_DAY, type ScenarioScale } from '../scales';
import { now, timeOfDay } from '../time';
import { actorById, isActive, isEngaged } from './relations';
import { givenTo, playerFound, playerIn } from './quests';
import { logCode } from './effects';
import { flushGrowth, keepGains, xpBar } from './growth';
import { triggerErrors } from '../scenario/triggers';
import { checkGround, offGround, onGround, pursuers } from './chase';

/** SC4: does a scenario of this scale hold smaller scenarios inside it */
export const holdsInner = (s: ScenarioScale): boolean => SCENARIO_SCALES.pos(s) >= SCENARIO_SCALES.pos(CONFIG.SCENARIO_HOLDS_FROM as ScenarioScale);

/** the smallest scale whose space holds this many places, never below `at` (SC3: code checks the plan fits its scale) */
export function scaleFor(places: number, at: ScenarioScale): ScenarioScale {
  for (const k of SCENARIO_SCALES.keys.slice(SCENARIO_SCALES.pos(at))) if (places <= CONFIG.SCENARIO_SCALE[k].places) return k;
  return SCENARIO_SCALES.keys[SCENARIO_SCALES.keys.length - 1];
}

/** the frame for a new scenario from its plan, with plan keys already mapped to ids by `ref` */
export function frameOf(state: GameState, scenario: StagePlan['scenario'], tier: Tier, ref: (kind: 'band' | 'place' | 'actor', key: string) => string): ScenarioFrame {
  const roam = state.stage.roamGrowth; // BG-217: a scenario after free roam counts the roam's XP in its gains
  delete state.stage.roamGrowth;
  const endings: PlanEnding[] = (Array.isArray(scenario?.endings) ? scenario!.endings : []).filter((e) => e && PLAN_AS.has(e.as) && e.when)
    .map((e) => ({ as: e.as as PlanEnding['as'], text: typeof e.text === 'string' ? e.text : '', when: mapCheck(e.when, ref) }))
    .filter((e) => checkable(state, e.when)); // a plan applied after a failed repair drops the endings that name nothing real
  return {
    question: scenario?.question ?? '', scale: SCENARIO_SCALES.keyOf(scenario?.scale) ?? 'situation', endings, tier,
    startTurn: state.turn, startMinute: now(state), number: state.stage.scenarioNumber,
    upAtStart: state.actors.filter(isActive).map((a) => a.id), heldAtStart: state.player.core.inventory.map((i) => i.itemId),
    xpFrom: roam?.xpFrom ?? state.player.progression?.xpLog?.length ?? 0, xpStart: roam?.xpStart ?? xpBar(state),
    ...(tier === 'critical_success' && state.stage.tierBeyond ? { beyond: state.stage.tierBeyond } : {}),
  };
}
const PLAN_AS = new Set<string>(PLAN_ENDINGS);
/** does everything this check names exist */
function checkable(state: GameState, w: EndCheck): boolean {
  const place = (r: string) => state.places.some((p) => p.id === r) || state.zones.some((z) => z.id === r);
  const actor = (r: string) => !!actorById(state, r);
  switch (w.kind) {
    case 'band_out': return state.bands.some((b) => b.id === w.band);
    case 'reach': case 'leave': return place(w.place);
    case 'find': return actor(w.actor);
    case 'deliver': return actor(w.to) && typeof w.item === 'string';
    case 'hold': return typeof w.item === 'string';
    case 'time': return !!TIME_OF_DAY.keyOf(w.at);
    case 'judged': return true;
    default: return false;
  }
}
function mapCheck(w: EndCheck, ref: (kind: 'band' | 'place' | 'actor', key: string) => string): EndCheck {
  switch (w.kind) {
    case 'band_out': return { kind: w.kind, band: ref('band', w.band) };
    case 'reach': case 'leave': return { kind: w.kind, place: ref('place', w.place) };
    case 'find': return { kind: w.kind, actor: ref('actor', w.actor) };
    case 'deliver': return { kind: w.kind, item: w.item, to: ref('actor', w.to) };
    default: return w;
  }
}

/** a band is out: every member is down, broken (fled or surrendered) or no longer on the stage */
function bandOut(state: GameState, band: string): boolean {
  const members = state.actors.filter((a) => a.bandId === band);
  return members.length > 0 && members.every((a) => !isActive(a) || !!a.mind?.moraleState || !state.stage.zoneIds.includes(a.zone));
}

/** is this ending's check met now (judged ones never are: the Weaver check-in decides them) */
export function checkMet(state: GameState, w: EndCheck, events: GameEvent[], frame: ScenarioFrame | undefined = state.stage.scenario): boolean {
  switch (w.kind) {
    case 'band_out': return bandOut(state, w.band);
    case 'reach': return playerIn(state, w.place);
    // BG-44: out of the place AND off the scenario's ground (a step into the lane mid-chase is not leaving)
    case 'leave': return !playerIn(state, w.place) && !!frame?.beenIn?.includes(w.place) && !(frame.ground && onGround(state, frame.ground, state.player.zone));
    case 'find': return playerFound(state, w.actor);
    case 'hold': return state.player.core.inventory.some((i) => i.itemId === w.item);
    case 'deliver': return givenTo(state, events, w.item, w.to) > 0;
    case 'time': return timeOfDay(now(state)) === TIME_OF_DAY.keyOf(w.at);
    case 'judged': return false;
  }
}

/** SC13: no ending while the player is fighting, being chased (a hostile hunting them), or in the middle of a talk */
export function endingHeld(state: GameState, events: GameEvent[]): string | null {
  const p = state.player;
  if (isEngaged(state, p)) return 'fight';
  if (pursuers(state).length) return 'chase'; // CH4
  if (events.some((e) => e.kind === 'speak' && (e.actorId === p.id || e.target === p.id))) return 'talk';
  return null;
}

/** After each turn: check the scenario's endings (the outer scenario's too), and end the scenario on the first clear turn. */
export function checkScenarioEnd(state: GameState, events: GameEvent[]): void {
  const st = state.stage;
  for (const f of [st.scenario, st.outer]) for (const e of f?.endings ?? []) {
    if (e.when.kind === 'leave' && playerIn(state, e.when.place) && !f!.beenIn?.includes(e.when.place)) (f!.beenIn ??= []).push(e.when.place);
  }
  if (!st.ending) {
    for (const [frame, outer] of [[st.scenario, false], [st.outer, true]] as const) {
      const hit = frame?.endings.find((e) => checkMet(state, e.when, events, frame));
      if (hit) { st.ending = { as: hit.as, text: hit.text, ...(outer ? { outer: true as const } : {}), turn: state.turn }; break; }
    }
    if (st.ending) logCode(state, 'scenario_ending_met', { as: st.ending.as, outer: !!st.ending.outer });
  }
  checkGround(state); // SC16/CH1: off the scenario's ground with no one chasing: left
  // a ground ending held over a fight or a talk lapses if the player is back on the ground by then
  if (st.ending?.roam && !offGround(state).off) { logCode(state, 'scenario_ground_back', { as: st.ending.as }); delete st.ending; }
  const f = st.scenario;
  // SC12: no Weaver can overrun the budget: at SCENARIO_OVERRUN_MULT times it, code ends the scenario (a bug: the check-in should have)
  if (f && !st.ending && !st.breakCause && budgetUsed(state, f) >= CONFIG.SCENARIO_OVERRUN_MULT) {
    st.ending = { as: 'worn_out', text: '', turn: state.turn };
    logCode(state, 'scenario_overrun', { number: f.number, scale: f.scale, turns: state.turn - f.startTurn });
  }
  if (f && !st.ending && !st.breakCause) dueCheckin(state, f);
  if (!st.ending || st.breakCause) return;
  const held = endingHeld(state, events);
  if (held) { logCode(state, 'scenario_ending_held', { as: st.ending.as, why: held }); return; }
  endScenario(state, st.ending.as, st.ending.text, st.ending.outer, st.ending.roam);
}

/** SC2/SC12/AT83: how much of its budget the scenario has used (1 = all of it), in game time */
export function budgetUsed(state: GameState, f: ScenarioFrame): number {
  const c = CONFIG.SCENARIO_SCALE[f.scale];
  return c?.budgetMin ? Math.max(0, now(state) - f.startMinute) / c.budgetMin : 0;
}

/** SC8: may a check-in be asked now (at most CHECKIN_MAX_PER_SCENARIO, CHECKIN_GAP_TURNS apart; /stuck skips both) */
export function checkinAllowed(state: GameState, f: ScenarioFrame, why?: CheckinReason): boolean {
  // BG-42: the over-time check-in (budget) always happens: the cap never stops it (it waits only for the gap)
  return (why === 'budget' || (f.checkins ?? 0) < CONFIG.CHECKIN_MAX_PER_SCENARIO) && (f.lastCheckin === undefined || state.turn - f.lastCheckin >= CONFIG.CHECKIN_GAP_TURNS);
}

/** SC8: the set moments a check-in is asked at: the scenario reached its budget, a beat fired, or the scenario has endings only
 * the Weaver can judge (then every CHECKIN_GAP_TURNS turns) */
function dueCheckin(state: GameState, f: ScenarioFrame): void {
  const st = state.stage;
  let why: CheckinReason | undefined;
  if (budgetUsed(state, f) >= 1 && !f.overTime) why = 'budget';
  else if (st.beatTurn === state.turn) why = 'beat';
  else if (f.endings.some((e) => e.when.kind === 'judged') && state.turn - (f.lastCheckin ?? f.startTurn) >= CONFIG.CHECKIN_GAP_TURNS) why = 'judged';
  if (!why || !checkinAllowed(state, f, why)) return;
  if (why === 'budget') f.overTime = true;
  st.checkinDue = why;
}

/** SC8: what is wrong with a check-in's answer (none: it can be applied) */
export function checkinErrors(state: GameState, a: CheckinAnswer | null): string[] {
  if (!a || typeof a !== 'object') return ['no answer'];
  if (a.verdict !== 'continue' && a.verdict !== 'end') return ['verdict is continue or end'];
  if (a.verdict === 'end' && !PLAN_AS.has(String(a.as))) return [`as is one of ${[...PLAN_AS].join(', ')}`];
  if (a.beats !== undefined && !Array.isArray(a.beats)) return ['beats is a list'];
  return (a.beats ?? []).flatMap((t) => triggerErrors(state, t, { isZone: (r) => state.stage.zoneIds.includes(r), isActor: (r) => !!actorById(state, r) }));
}

/** a check-in's continue checked and applied by the caller: a scenario change, arrivals and frontiers (SC12) */
export type CheckinExtras = { errors: (a: CheckinAnswer) => string[]; apply: (a: CheckinAnswer) => Record<string, unknown> };
/**
 * SC8/SC14: apply a check-in's answer to the scenario it was asked about (dropped if that scenario is over). A failed or invalid
 * answer changes nothing and files a bug; the next set moment asks again. An end waits for a clear turn (SC13) like any ending.
 */
export function applyCheckin(state: GameState, number: number, a: CheckinAnswer | null, events: GameEvent[], extras?: CheckinExtras): void {
  const st = state.stage;
  if (st.scenario?.number !== number || st.breakCause) return;
  // SC12: a continue's scenario change, arrivals and frontiers are checked with the rest; one bad part drops the whole answer
  const errors = checkinErrors(state, a);
  if (!errors.length && a!.verdict === 'continue' && extras) errors.push(...extras.errors(a!));
  if (errors.length) { logCode(state, 'checkin_failed', { number, errors }); return; }
  if (a!.verdict === 'end') {
    st.ending ??= { as: a!.as as ScenarioEnding, text: a!.text ?? '', turn: state.turn };
    logCode(state, 'checkin_end', { as: st.ending.as });
    if (!endingHeld(state, events)) { endScenario(state, st.ending.as, st.ending.text, st.ending.outer); closeScenario(state); }
    return;
  }
  for (const [i, t] of (a!.beats ?? []).entries()) {
    const beat = { ...t, id: `ci${state.turn}_${i}_${t.id}`, once: t.once ?? true };
    (state.hidden.plans[t.ownerId] ??= { goal: '', steps: [], triggers: [], createdTurn: state.turn }).triggers.push(beat);
  }
  const did = a!.verdict === 'continue' && extras ? extras.apply(a!) : {};
  logCode(state, 'checkin_continue', { beats: a!.beats?.length ?? 0, ...did });
}

/** ends the scenario this turn with `as` (outer: the bigger scenario's own ending, which ends both) */
export function endScenario(state: GameState, as: ScenarioEnding, text = '', outer?: boolean, roam?: boolean): void {
  state.stage.ended = { as, text, ...(outer ? { outer: true as const } : {}), ...(roam ? { roam: true as const } : {}) };
  state.stage.breakCause = 'scenario_end';
  delete state.stage.ending;
  logCode(state, 'scenario_ended', { as, outer: !!outer });
}

/** SD1: how the scenario ends at this turn's break, before closeScenario records it (null: no break, or no scenario yet) */
export function pendingEnding(state: GameState): ScenarioEnding | null {
  const st = state.stage;
  if (st.closed?.turn === state.turn) return st.closed.as; // the turn already closed it (resolveTurn records the scenario)
  if (!st.breakCause || !st.scenario) return null;
  return st.ended?.as ?? BREAK_ENDING[st.breakCause] ?? 'interrupted';
}

/** how a break that is not an ending ends the scenario (SC9, SC10) */
const BREAK_ENDING: Record<string, ScenarioEnding> = { knocked_out: 'broken_off', encounter: 'interrupted', story_beat: 'worn_out', roam: 'interrupted' };

function record(state: GameState, f: ScenarioFrame, as: ScenarioEnding, text: string, inner: boolean): ScenarioRecord {
  const name = (id: string) => actorById(state, id)?.names.current ?? id;
  const held = new Set(f.heldAtStart);
  return {
    number: f.number, question: f.question, scale: f.scale, tier: f.tier, ending: as, text, startTurn: f.startTurn, endTurn: state.turn,
    fallen: [...f.upAtStart.filter((id) => !isActive(actorById(state, id) ?? state.player)).map(name), ...(as === 'broken_off' ? ['the player'] : [])],
    gained: [...new Set(state.player.core.inventory.map((i) => i.itemId).filter((x) => !held.has(x)))],
    ...(inner ? { inner: true as const } : {}),
    ...waysOf(state, f.number),
  };
}
/** BA8: the barriers made in scenario `n`, counted for the GM view */
function waysOf(state: GameState, n: number): Pick<ScenarioRecord, 'ways'> {
  const made = Object.values(state.barriers ?? {}).filter((b) => b.scenario === n);
  if (!made.length) return {};
  const grades: Partial<Record<Grade, number>> = {};
  for (const b of made) grades[b.grade] = (grades[b.grade] ?? 0) + 1;
  const count = (f: (b: (typeof made)[number]) => unknown) => made.filter(f).length;
  return { ways: { barriers: made.length, locked: count((b) => b.lock), barred: count((b) => b.bar), blocked: count((b) => b.blocked), guarded: count((b) => b.guarded), grades } };
}
function keep(state: GameState, r: ScenarioRecord): void {
  const log = (state.hidden.scenarios ??= []);
  log.push(r);
  if (log.length > CONFIG.SCENARIO_RECORDS_SAVED) log.splice(0, log.length - CONFIG.SCENARIO_RECORDS_SAVED);
}

/** the bigger scenario's owed rolls and waiting achievements, kept apart while an inner one ran, join the player's again */
function restoreHeld(outer: ScenarioFrame, pr: NonNullable<GameState['player']['progression']>): void {
  if (!outer.held) return;
  pr.marks = [...outer.held.marks, ...pr.marks];
  if (outer.held.pending) pr.pendingAchievements = [...outer.held.pending, ...(pr.pendingAchievements ?? [])];
  delete outer.held;
}

/** D-226: two scenarios' raises and All-XXX as one (the bigger scenario's first) */
type Part = NonNullable<ScenarioFrame['gains']>;
function mergeGains(a?: Part, b?: Part): Part | undefined {
  if (!a || !b) return a ?? b;
  const skills = a.skills.map((x) => ({ ...x }));
  for (const x of b.skills) { const s = skills.find((y) => y.skill === x.skill); if (s) s.to = x.to; else skills.push({ ...x }); }
  return { skills, perks: [...a.perks, ...b.perks], allPerks: [...a.allPerks, ...b.allPerks] };
}

/**
 * At a break, before the next scenario starts: record how the scenario went, and say what comes next. 'resume' = an inner scenario
 * ended inside a bigger one, which carries on (no event roll, no Weaver call); 'new' = a new scenario starts (an encounter
 * inside an Episode or Venture starts an inner one, keeping the bigger scenario as `outer`); 'roam' = free roam starts, and no
 * scenario runs until something starts one (SD2 a): after leaving the ground (SC16), escaping off it (CH7), or any ending
 * CONFIG.ROAM_AFTER lists (every ending for now, so players can explore the world).
 */
export function closeScenario(state: GameState, rng?: Rng): 'resume' | 'new' | 'roam' {
  const st = state.stage;
  const cause = st.breakCause;
  const as = st.ended?.as ?? (cause ? BREAK_ENDING[cause] : undefined) ?? 'interrupted';
  const text = st.ended?.text ?? '';
  const cur = st.scenario, outer = st.outer;
  // free roam after the endings CONFIG.ROAM_AFTER lists; a road encounter or a knock-out starts the next scenario instead
  const roam = !!cur && cause !== 'encounter' && cause !== 'knocked_out' && (!!st.ended?.roam || CONFIG.ROAM_AFTER.includes(as));
  const endsOuter = !!st.ended?.outer || cause === 'knocked_out';
  // SC4: an encounter inside an Episode or Venture: this scenario carries on as the bigger one, so it pays nothing yet; its
  // owed rolls and waiting achievements are kept apart while the inner scenario runs
  const becomesOuter = !!cur && !outer && !endsOuter && cause === 'encounter' && holdsInner(cur.scale);
  const pr = state.player.progression;
  if (becomesOuter && pr) { cur!.held = { marks: pr.marks, ...(pr.pendingAchievements ? { pending: pr.pendingAchievements } : {}) }; pr.marks = []; delete pr.pendingAchievements; }
  if (endsOuter && outer && pr) restoreHeld(outer, pr); // both end: the bigger scenario's waiting growth joins the inner's, paid at its ending
  // D-226/EG7: what waited for the end is paid and granted now, with one gains summary (both scenarios' when the bigger one ends too)
  if (cur && !becomesOuter) {
    const f = endsOuter && outer ? { ...cur, tier: outer.tier, beyond: outer.beyond, gains: mergeGains(outer.gains, cur.gains), xpFrom: outer.xpFrom, xpStart: outer.xpStart, startTurn: outer.startTurn } : cur;
    const r = rng ?? createRng(state.rngState);
    flushGrowth(state, f, as, r);
    if (!rng) state.rngState = r.state;
    keepGains(state, as); // the Gains page keeps every scenario's gains
  }
  if (cur) keep(state, record(state, cur, endsOuter && outer ? 'interrupted' : as, text, !!outer));
  if (outer && endsOuter) keep(state, record(state, outer, as, text, false));
  if (cur) st.closed = { as, turn: state.turn }; // SD1: the ending moment reads it after resolveTurn
  delete st.ended; delete st.ending;
  if (outer && !endsOuter) {
    if (cause === 'encounter') { delete st.scenario; return 'new'; } // a new inner scenario in the same bigger one
    st.scenario = outer; delete st.outer; // SC4: the bigger scenario carries on
    if (pr) restoreHeld(outer, pr); // its owed rolls and waiting achievements come back
    outer.xpFrom = state.player.progression?.xpLog?.length ?? 0; outer.xpStart = xpBar(state); // D-226: the inner scenario's XP was in its own summary
    delete st.breakCause;
    logCode(state, 'scenario_resumed', { number: outer.number });
    return 'resume';
  }
  delete st.outer;
  if (cur && !endsOuter && cause === 'encounter' && holdsInner(cur.scale)) st.outer = cur; // SC4: the encounter is an inner scenario
  delete st.scenario;
  if (roam) {
    delete st.breakCause;
    st.roam = { since: state.turn, sinceMin: now(state), rest: CONFIG.ROAM_REST_MIN[state.hidden.stage?.challenge] ?? 0 }; // WB7
    st.roamGrowth = { xpFrom: state.player.progression?.xpLog?.length ?? 0, xpStart: xpBar(state) }; // BG-217
    logCode(state, 'free_roam', { as });
    return 'roam';
  }
  return 'new';
}

/** the last few scenario records, for the next Weaver (SC6) */
export const lastScenarios = (state: GameState): ScenarioRecord[] => (state.hidden.scenarios ?? []).slice(-CONFIG.SCENARIO_RECORDS_SHOWN);
