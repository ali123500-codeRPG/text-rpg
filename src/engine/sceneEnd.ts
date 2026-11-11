// Scenes as situations (SC1–SC10): a scene's hidden question, scale and endings; code checks the endings every turn,
// holds one met mid-fight, mid-chase or mid-talk (SC13), and keeps a record of how each scene went (SC6). An Episode or
// Venture holds smaller scenes one level deep (SC4): a road encounter inside one starts an inner scene, and when that ends
// the bigger scene carries on with no new event roll and no Weaver call.
import type { CheckinAnswer, CheckinReason, EndCheck, GameEvent, GameState, PlanEnding, SceneEnding, SceneFrame, SceneRecord, StagePlan, Tier } from '../types';
import { CONFIG } from '../config';
import { SCENE_SCALES, TIME_OF_DAY, type SceneScale } from '../scales';
import { now, timeOfDay } from '../time';
import { actorById, atLeast, isActive, isEngaged } from './relations';
import { givenTo, playerFound, playerIn } from './quests';
import { logCode } from './effects';
import { triggerErrors } from '../scene/triggers';

/** SC4: does a scene of this scale hold smaller scenes inside it */
export const holdsInner = (s: SceneScale): boolean => SCENE_SCALES.pos(s) >= SCENE_SCALES.pos(CONFIG.SCENE_HOLDS_FROM as SceneScale);

/** the smallest scale whose space holds this many places, never below `at` (SC3: code checks the plan fits its scale) */
export function scaleFor(places: number, at: SceneScale): SceneScale {
  for (const k of SCENE_SCALES.keys.slice(SCENE_SCALES.pos(at))) if (places <= CONFIG.SCENE_SCALE[k].places) return k;
  return SCENE_SCALES.keys[SCENE_SCALES.keys.length - 1];
}

/** the frame for a new scene from its plan, with plan keys already mapped to ids by `ref` */
export function frameOf(state: GameState, scene: StagePlan['scene'], tier: Tier, ref: (kind: 'band' | 'place' | 'actor', key: string) => string): SceneFrame {
  const endings: PlanEnding[] = (Array.isArray(scene?.endings) ? scene!.endings : []).filter((e) => e && PLAN_AS.has(e.as) && e.when)
    .map((e) => ({ as: e.as as PlanEnding['as'], text: typeof e.text === 'string' ? e.text : '', when: mapCheck(e.when, ref) }))
    .filter((e) => checkable(state, e.when)); // a plan applied after a failed repair drops the endings that name nothing real
  return {
    question: scene?.question ?? '', scale: SCENE_SCALES.keyOf(scene?.scale) ?? 'situation', endings, tier,
    startTurn: state.turn, startMinute: now(state), number: state.stage.sceneNumber,
    upAtStart: state.actors.filter(isActive).map((a) => a.id), heldAtStart: state.player.core.inventory.map((i) => i.itemId),
  };
}
const PLAN_AS = new Set<string>(['resolved', 'lost', 'left', 'escaped', 'interrupted']);
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
export function checkMet(state: GameState, w: EndCheck, events: GameEvent[], frame: SceneFrame | undefined = state.stage.scene): boolean {
  switch (w.kind) {
    case 'band_out': return bandOut(state, w.band);
    case 'reach': return playerIn(state, w.place);
    case 'leave': return !playerIn(state, w.place) && !!frame?.beenIn?.includes(w.place);
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
  if (state.actors.some((a) => isActive(a) && atLeast(a.mind?.knowledge[p.id]?.status, 'hunting') && !a.mind?.moraleState)) return 'chase';
  if (events.some((e) => e.kind === 'speak' && (e.actorId === p.id || e.target === p.id))) return 'talk';
  return null;
}

/** After each turn: check the scene's endings (the outer scene's too), and end the scene on the first clear turn. */
export function checkSceneEnd(state: GameState, events: GameEvent[]): void {
  const st = state.stage;
  for (const f of [st.scene, st.outer]) if (f && isEngaged(state, state.player)) f.fightTurns = (f.fightTurns ?? 0) + 1; // SC2: fights don't use the budget
  for (const f of [st.scene, st.outer]) for (const e of f?.endings ?? []) {
    if (e.when.kind === 'leave' && playerIn(state, e.when.place) && !f!.beenIn?.includes(e.when.place)) (f!.beenIn ??= []).push(e.when.place);
  }
  if (!st.ending) {
    for (const [frame, outer] of [[st.scene, false], [st.outer, true]] as const) {
      const hit = frame?.endings.find((e) => checkMet(state, e.when, events, frame));
      if (hit) { st.ending = { as: hit.as, text: hit.text, ...(outer ? { outer: true as const } : {}), turn: state.turn }; break; }
    }
    if (st.ending) logCode(state, 'scene_ending_met', { as: st.ending.as, outer: !!st.ending.outer });
  }
  const f = st.scene;
  // SC12: no Weaver can overrun the budget: at SCENE_OVERRUN_MULT times it, code ends the scene (a bug: the check-in should have)
  if (f && !st.ending && !st.breakCause && budgetUsed(state, f) >= CONFIG.SCENE_OVERRUN_MULT) {
    st.ending = { as: 'worn_out', text: '', turn: state.turn };
    logCode(state, 'scene_overrun', { number: f.number, scale: f.scale, turns: state.turn - f.startTurn });
  }
  if (f && !st.ending && !st.breakCause) dueCheckin(state, f);
  if (!st.ending || st.breakCause) return;
  const held = endingHeld(state, events);
  if (held) { logCode(state, 'scene_ending_held', { as: st.ending.as, why: held }); return; }
  endScene(state, st.ending.as, st.ending.text, st.ending.outer);
}

/** SC2/SC12: how much of its budget the scene has used (1 = all of it); turns spent fighting don't count */
export function budgetUsed(state: GameState, f: SceneFrame): number {
  const c = CONFIG.SCENE_SCALE[f.scale];
  if (c?.budgetTurns) return Math.max(0, state.turn - f.startTurn - (f.fightTurns ?? 0)) / c.budgetTurns;
  if (c?.budgetDays) return (now(state) - f.startMinute) / (c.budgetDays * 24 * 60);
  return 0;
}

/** SC8: may a check-in be asked now (at most CHECKIN_MAX_PER_SCENE, CHECKIN_GAP_TURNS apart; /stuck skips both) */
export function checkinAllowed(state: GameState, f: SceneFrame): boolean {
  return (f.checkins ?? 0) < CONFIG.CHECKIN_MAX_PER_SCENE && (f.lastCheckin === undefined || state.turn - f.lastCheckin >= CONFIG.CHECKIN_GAP_TURNS);
}

/** SC8: the set moments a check-in is asked at: the scene reached its budget, a beat fired, or the scene has endings only
 * the Weaver can judge (then every CHECKIN_GAP_TURNS turns) */
function dueCheckin(state: GameState, f: SceneFrame): void {
  const st = state.stage;
  let why: CheckinReason | undefined;
  if (budgetUsed(state, f) >= 1 && !f.overTime) why = 'budget';
  else if (st.beatTurn === state.turn) why = 'beat';
  else if (f.endings.some((e) => e.when.kind === 'judged') && state.turn - (f.lastCheckin ?? f.startTurn) >= CONFIG.CHECKIN_GAP_TURNS) why = 'judged';
  if (!why || !checkinAllowed(state, f)) return;
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

/**
 * SC8/SC14: apply a check-in's answer to the scene it was asked about (dropped if that scene is over). A failed or invalid
 * answer changes nothing and files a bug; the next set moment asks again. An end waits for a clear turn (SC13) like any ending.
 */
export function applyCheckin(state: GameState, number: number, a: CheckinAnswer | null, events: GameEvent[]): void {
  const st = state.stage;
  if (st.scene?.number !== number || st.breakCause) return;
  const errors = checkinErrors(state, a);
  if (errors.length) { logCode(state, 'checkin_failed', { number, errors }); return; }
  if (a!.verdict === 'end') {
    st.ending ??= { as: a!.as as SceneEnding, text: a!.text ?? '', turn: state.turn };
    logCode(state, 'checkin_end', { as: st.ending.as });
    if (!endingHeld(state, events)) { endScene(state, st.ending.as, st.ending.text, st.ending.outer); closeScene(state); }
    return;
  }
  for (const [i, t] of (a!.beats ?? []).entries()) {
    const beat = { ...t, id: `ci${state.turn}_${i}_${t.id}`, once: t.once ?? true };
    (state.hidden.plans[t.ownerId] ??= { goal: '', steps: [], triggers: [], createdTurn: state.turn }).triggers.push(beat);
  }
  logCode(state, 'checkin_continue', { beats: a!.beats?.length ?? 0 });
}

/** ends the scene this turn with `as` (outer: the bigger scene's own ending, which ends both) */
export function endScene(state: GameState, as: SceneEnding, text = '', outer?: boolean): void {
  state.stage.ended = { as, text, ...(outer ? { outer: true as const } : {}) };
  state.stage.breakCause = 'scene_end';
  delete state.stage.ending;
  logCode(state, 'scene_ended', { as, outer: !!outer });
}

/** SD1: how the scene ends at this turn's break, before closeScene records it (null: no break, or no scene yet) */
export function pendingEnding(state: GameState): SceneEnding | null {
  const st = state.stage;
  if (!st.breakCause || !st.scene) return null;
  return st.ended?.as ?? BREAK_ENDING[st.breakCause] ?? 'interrupted';
}

/** how a break that is not an ending ends the scene (SC9, SC10) */
const BREAK_ENDING: Record<string, SceneEnding> = { knocked_out: 'broken_off', encounter: 'interrupted', story_beat: 'worn_out' };

function record(state: GameState, f: SceneFrame, as: SceneEnding, text: string, inner: boolean): SceneRecord {
  const name = (id: string) => actorById(state, id)?.names.current ?? id;
  const held = new Set(f.heldAtStart);
  return {
    number: f.number, question: f.question, scale: f.scale, tier: f.tier, ending: as, text, startTurn: f.startTurn, endTurn: state.turn,
    fallen: [...f.upAtStart.filter((id) => !isActive(actorById(state, id) ?? state.player)).map(name), ...(as === 'broken_off' ? ['the player'] : [])],
    gained: [...new Set(state.player.core.inventory.map((i) => i.itemId).filter((x) => !held.has(x)))],
    ...(inner ? { inner: true as const } : {}),
  };
}
function keep(state: GameState, r: SceneRecord): void {
  const log = (state.hidden.scenes ??= []);
  log.push(r);
  if (log.length > CONFIG.SCENE_RECORDS_SAVED) log.splice(0, log.length - CONFIG.SCENE_RECORDS_SAVED);
}

/**
 * At a break, before the next scene starts: record how the scene went, and say what comes next. 'resume' = an inner scene
 * ended inside a bigger one, which carries on (no event roll, no Weaver call); 'new' = a new scene starts (an encounter
 * inside an Episode or Venture starts an inner one, keeping the bigger scene as `outer`).
 */
export function closeScene(state: GameState): 'resume' | 'new' {
  const st = state.stage;
  const cause = st.breakCause;
  const as = st.ended?.as ?? (cause ? BREAK_ENDING[cause] : undefined) ?? 'interrupted';
  const text = st.ended?.text ?? '';
  const cur = st.scene, outer = st.outer;
  const endsOuter = !!st.ended?.outer || cause === 'knocked_out';
  if (cur) keep(state, record(state, cur, endsOuter && outer ? 'interrupted' : as, text, !!outer));
  if (outer && endsOuter) keep(state, record(state, outer, as, text, false));
  delete st.ended; delete st.ending;
  if (outer && !endsOuter) {
    if (cause === 'encounter') { delete st.scene; return 'new'; } // a new inner scene in the same bigger one
    st.scene = outer; delete st.outer; // SC4: the bigger scene carries on
    delete st.breakCause;
    logCode(state, 'scene_resumed', { number: outer.number });
    return 'resume';
  }
  delete st.outer;
  if (cur && !endsOuter && cause === 'encounter' && holdsInner(cur.scale)) st.outer = cur; // SC4: the encounter is an inner scene
  delete st.scene;
  return 'new';
}

/** the last few scene records, for the next Weaver (SC6) */
export const lastScenes = (state: GameState): SceneRecord[] => (state.hidden.scenes ?? []).slice(-CONFIG.SCENE_RECORDS_SHOWN);
