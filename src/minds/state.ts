// State-side minds work: routine install and switch, the alarm machine, Explore detection and ambush.
import { FN } from '../library/functionIds';
import type { Actor, ActorView, ContestResult, GameEvent, GameState, ItemInstance, Order, Rng, RollResult, Zone } from '../types';
import { TIERS } from '../scales';
import { itemDef } from '../library';
import { hiddenFrom } from '../engine/gear';
import { CONFIG } from '../config';
import { now, timeOfDay } from '../time';
import { routine as getRoutine, routineSet, actorBody, npcTemplate } from '../library';
import { actorById, allActors, atLeast, isActive, isAsleep, isEngaged, sparring, wary, zoneById } from '../engine/relations';
import { beliefStatus, computePerception, perceptionOf, updateBeliefs } from '../perception';
import { markUse, ruleset, situational, fnRoller, tierLevel, usableModes, defaultMode, modeSkill, effectiveSkill } from '../ruleset';
import { rollFnSkills } from '../ruleset/gear';
import { rewardSum } from '../ruleset/achRewards';
import { distM, seeingM, withinGrip, withinM, type Located } from '../engine/position';
import { hasPerk } from '../ruleset/perks';
import { bindTemplate, expandSteps, HEAD_TO, offeredRoutines, slotsRead } from './routines';
import { SK, SENSE_SKILL } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { contestFeat } from '../engine/feats';
import { tally } from '../engine/xp';

const log = (state: GameState, code: string, detail: Record<string, unknown>) => state.log.push({ turn: state.turn, code, detail });

/** at: the game minute now (NW10; an unset clock reads as the start of day) */
export function installRoutines(actor: Actor, setId: string, slots: Record<string, string | string[]>, startAt: string | undefined, turn: number, rng: Rng, at = CONFIG.TIME_OF_DAY_FROM.morning): void {
  const set = routineSet(setId);
  if (!set) throw new Error(`unknown routine set ${setId}`);
  const mind = actor.mind!;
  mind.routineSetId = setId;
  mind.routines = [...set.routines];
  mind.slots = { ...slots };
  const r = getRoutine(set.routines[0]);
  const stops = r.kind === 'schedule' ? expandSteps(r, mind.slots, timeOfDay(at)) : [];
  const total = stops.reduce((n, s) => n + s.minutes, 0);
  // NW10: started back in time so it stands at its startAt step, or (a loop) somewhere along it at random
  let back = 0;
  const i = startAt ? stops.findIndex((s) => s.slot === startAt) : -1;
  if (i >= 0) back = stops.slice(0, i).reduce((n, s) => n + s.minutes, 0);
  else if (!startAt && r.loop && total > 0) back = rng.int(0, total - 1);
  mind.routine = { id: r.id, anchorTurn: turn, at: at - back };
}

export function switchRoutine(state: GameState, actor: Actor, routineId: string, reason: 'agent' | 'bandmate'): boolean {
  const mind = actor.mind;
  // BG-34: an agent may switch its own actor to follow whatever its set; bandmates never take follow from a spokesperson
  const offered = reason === 'agent' ? offeredRoutines(mind?.routines) : mind?.routines ?? [];
  const r = offered.includes(routineId) ? getRoutineOrNull(routineId) : null;
  // RT: an optional slot of its set (a bed, a seat) may stay unbound; the actor stays put at the times that read it
  const optional = (s: string) => !!(mind?.routineSetId && routineSet(mind.routineSetId)?.slots[s]?.optional);
  const unbound = r ? slotsRead(r).filter((s) => !hasBinding(mind!.slots?.[s]) && !optional(s)) : [];
  if (!mind || !r || unbound.length) {
    log(state, reason === 'agent' ? 'invalid_routine' : 'routine_skip', { actorId: actor.id, routineId, ...(unbound.length ? { unbound } : {}) });
    return false;
  }
  mind.routine = { id: routineId, anchorTurn: state.turn, at: now(state) };
  if (r.kind === 'wait') mind.slots = { ...mind.slots, here: actor.zone };
  if (mind.alarm?.returnTo) delete mind.alarm.returnTo;
  return true;
}

/** NW2: an agent sends its NPC somewhere further than one move (a zone or a frontier on the stage): it switches to the
 * shared head_to routine, walks there by code on later turns with no more calls, then goes back to the routine it had.
 * A second headTo on the way changes only where it is going. Returns false (logged) for a place not on the stage. */
export function headTo(state: GameState, actor: Actor, dest: string, by: 'agent' | 'weaver' | 'yield' = 'agent', lead?: string): boolean {
  const mind = actor.mind;
  const onStage = state.stage.zoneIds.includes(dest) || state.zones.some((z) => state.stage.zoneIds.includes(z.id) && z.links.some((l) => l.frontier && l.to === dest));
  if (!mind || !onStage) {
    log(state, 'invalid_head_to', { actorId: actor.id, dest, by });
    return false;
  }
  if (dest === actor.zone && !lead) return true; // BG-139: one leading someone waits where it is, even there already
  if (lead && actorById(state, lead)) mind.leading = { id: lead }; // BF4
  else delete mind.leading;
  if (mind.routine?.id !== HEAD_TO) {
    if (mind.routine) mind.headBack = { ...mind.routine };
    else delete mind.headBack;
  }
  mind.routine = { id: HEAD_TO, anchorTurn: state.turn, at: now(state) };
  mind.slots = { ...mind.slots, dest };
  if (mind.alarm?.returnTo) delete mind.alarm.returnTo;
  log(state, 'head_to', { actorId: actor.id, dest, by });
  return true;
}

/** NW2: a head_to walk that got where it was going goes back to the routine it had, from there (end of turn) */
/** BF11: an NPC its own agent moved somewhere stays there while it holds (AGENT_STAY_TURNS): no routine walk, no catch-up */
export const staying = (state: GameState, a: Actor): boolean => !!a.mind?.stay && a.mind.stay.zone === a.zone && state.turn <= a.mind.stay.until;

export function headArrivals(state: GameState): void {
  for (const a of state.actors) {
    const m = a.mind;
    if (m?.routine?.id !== HEAD_TO) continue;
    const dest = m.slots?.dest;
    if ((Array.isArray(dest) ? dest[0] : dest) !== a.zone) continue;
    // BF4: leading someone, it waits there until they come or LEAD_WAIT_TURNS pass
    if (m.leading && actorById(state, m.leading.id)?.zone !== a.zone && state.turn - (m.leading.since ??= state.turn) < CONFIG.LEAD_WAIT_TURNS) continue;
    delete m.leading;
    if (m.headBack) m.routine = m.headBack;
    else delete m.routine;
    delete m.headBack;
    if (m.slots) delete m.slots.dest;
    log(state, 'head_to_arrived', { actorId: a.id, zone: a.zone });
  }
}

function getRoutineOrNull(id: string) {
  try {
    return getRoutine(id);
  } catch {
    return null;
  }
}
const hasBinding = (b: string | string[] | undefined) => (Array.isArray(b) ? b.length > 0 : !!b);

/** Calm bandmates [Proposed]: calm, routine-run bandmates of the spokesperson who perceived the exchange take its new routine. */
/**
 * Calm bandmates [Proposed] (Dialogue turn rules): when a spokesperson's output switches its routine, calm, code-run
 * bandmates who perceived the exchange switch to the same routine. The one rule for this; the engine calls it.
 * GAP: "calm" read as not engaged, alarm not armed, and no attack or alarm perceived within DECAY_TURNS.
 */
export function calmBandmatesSwitch(state: GameState, spokespersonId: string, routineId: string, heard: (actorId: string) => boolean): string[] {
  const sp = actorById(state, spokespersonId);
  if (!sp) return [];
  const switched: string[] = [];
  for (const a of [...state.actors].sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.id === sp.id || a.bandId !== sp.bandId || !isActive(a) || a.mind?.control !== 'code' || !heard(a.id)) continue;
    if (!isCalm(state, a)) continue; // engaged or alarmed bandmates decide through their own mind
    if (switchRoutine(state, a, routineId, 'bandmate')) switched.push(a.id);
  }
  return switched;
}

export function isCalm(state: GameState, a: Actor): boolean {
  const alarm = a.mind?.alarm;
  const last = alarm?.lastAlarmTurn;
  return !isEngaged(state, a) && !alarm?.armed && (last === undefined || state.turn - last >= CONFIG.DECAY_TURNS);
}

const ALARM_KINDS = new Set(['attack', 'alarm']);

/** onAlert once (queued as onAlertDue), switch to the alert variant anchored now, save returnTo. */
export function raiseAlarm(state: GameState, a: Actor): void {
  const mind = a.mind!;
  const alarm = (mind.alarm ??= { armed: false });
  alarm.lastAlarmTurn = state.turn;
  if (alarm.armed) return;
  alarm.armed = true;
  if (!mind.routine) return;
  const r = getRoutine(mind.routine.id);
  if (r.onAlert) alarm.onAlertDue = r.id;
  if (r.alert && mind.routines?.includes(r.alert)) {
    alarm.returnTo = { ...mind.routine };
    mind.routine = { id: r.alert, anchorTurn: state.turn, at: now(state) };
  }
}

/** it believes (suspicious or more) in someone it is wary of: leaving unaware of them is what raises the alarm */
const knowsWary = (state: GameState, a: Actor): boolean => Object.entries(a.mind?.knowledge ?? {}).some(([id, b]) => {
  const o = actorById(state, id);
  return !!o && wary(state, a, o) && atLeast(b.status, 'suspicious');
});

/** BF1 (BG-114): knowing someone from a scenario's start is not noticing them: an actor that starts out knowing someone it
 * is wary of is armed (that alarm spent) with no alarm raised, so it keeps its routine; it alarms again only after losing
 * track of every wary actor and then noticing one */
export function knownFromTheStart(state: GameState, actors: Actor[]): void {
  for (const a of actors) if (a.mind && !a.mind.alarm?.armed && knowsWary(state, a)) (a.mind.alarm ??= { armed: false }).armed = true;
}

export function updateAlarms(state: GameState, events: GameEvent[]): void {
  for (const a of state.actors) {
    if (!a.mind || !isActive(a)) continue;
    const perceivedAlarm = events.some((e) => e.actorId !== a.id && ALARM_KINDS.has(e.kind) && !e.spar && !!e.perception[a.id]); // SP11: a spar raises no alarm
    const leftUnaware = knowsWary(state, a);
    if (perceivedAlarm || (leftUnaware && !a.mind.alarm?.armed)) {
      raiseAlarm(state, a);
      continue;
    }
    const alarm = a.mind.alarm;
    if (!alarm?.armed || (alarm.lastAlarmTurn !== undefined && state.turn - alarm.lastAlarmTurn < CONFIG.DECAY_TURNS)) continue; // BF1: armed from the start has no alarm to wait out
    // calm: back to the saved routine with its saved anchor
    if (alarm.returnTo) {
      a.mind.routine = { ...alarm.returnTo };
      delete alarm.returnTo;
    }
    // GAP: the armed flag also needs "unaware of every wary actor" (Hidden state persistence); the routine return uses the timer only (Alarm).
    if (!leftUnaware) {
      alarm.armed = false;
      delete alarm.onAlertDue;
    }
  }
}

export function alertOrders(state: GameState, views: ActorView[]): Order[] {
  const out: Order[] = [];
  for (const v of views) {
    const alarm = actorById(state, v.self.id)?.mind?.alarm;
    const due = alarm?.onAlertDue;
    if (!due) continue;
    delete alarm!.onAlertDue;
    if (state.turn - (alarm!.lastAlarmTurn ?? state.turn) > 1) continue; // BG-94: only the turn after the alarm, never a stale shout
    const tpl = getRoutine(due).onAlert;
    if (tpl) out.push(bindTemplate(tpl, v, { source: 'onAlert' }));
  }
  return out;
}

/** ST2: Combat Stealth in an engagement, or for a shot, which starts one (ST5); Sneaking otherwise */
export const stealthSkill = (s: Actor, event?: GameEvent): string => (s.engagement || event?.kind === 'attack' ? SK.combat_stealth : SK.sneaking);

type Sense = typeof FN.sight | typeof FN.hearing;
/** the hider's stealth roll against one sense. ST21/ST22: light and cover reach it by situation tag; a Hide adds the hide
 * tag and ignores leg wounds (ST10). P14: darkness never hurts hearing, so it gives no help against one who only hears.
 * All-50 Hushed Steps: the owner's Sneaking Near Miss counts as a Success against one who only hears. */
function hiderRoll(state: GameState, s: Actor, sk: string, sense: Sense, hide: boolean) {
  const zone = zoneById(state, s.zone);
  const hushed = sk === SK.sneaking && sense === FN.hearing && hasPerk(s, PK.hushed_steps) ? { nearMissUp: 'Hushed Steps' } : {};
  return { actorId: s.id, skill: sk, ...situational(state, sk, { light: sense === FN.sight ? zone : undefined, cover: zone, add: hide ? ['hide'] : [], actor: s }), rollKind: 'stealth' as const, ...(hide ? { roles: [] } : {}), ...hushed };
}
/** the watcher's sense roll in the light where the hider is: a function roll, the best sight (or hearing) skill at full value */
function watcherRoll(state: GameState, a: Actor, sense: Sense, light: Zone | undefined) {
  return { actorId: a.id, skill: SENSE_SKILL[sense], ...situational(state, fnRoller(state, a, sense), { light, actor: a }), rollKind: 'perception' as const, fn: sense };
}
/** ST4/SE5: this turn's stealth contests, one per hider and watcher (`key`) */
function contestedThisTurn(state: GameState): { turn: number; ids: string[] } {
  const sc = (state.scratch ??= {});
  const done = (sc.stealthContested as { turn: number; ids: string[] } | undefined)?.turn === state.turn ? (sc.stealthContested as { turn: number; ids: string[] }) : { turn: state.turn, ids: [] };
  sc.stealthContested = done;
  return done;
}
const pairKey = (s: Actor, a: Actor) => (s.kind === 'player' ? a.id : `${s.id}>${a.id}`);

/** ST3–ST8, ST11–ST19, NS1–NS5: while an actor is stealthy, every observer outside its band who could perceive the event and
 * doesn't already see it contests its sight or hearing against the actor's stealth, once per turn. The player is an observer
 * like any other (NS3); NPCs contest each other too (NS5). Observer wins: aware. Tie: an unaware observer turns suspicious. A Vanish (a move) is contested
 * with Vanishing by everyone, those who see the actor included: one who loses it drops to suspicious at the zone the actor
 * left (ST15); for the rest it counts as a passed stealth check (ST16). A shot's target that loses still turns suspicious,
 * at the shooter's zone (ST19). Light and cover reach the rolls by situation tag (CONFIG.SITUATION_TAGS, ST21); a hide
 * ignores leg wounds (ST10). With Unblinking, an observer who loses a Vanish must also lose a Sneaking or Combat Stealth
 * contest (ST23). */
export function stealthDetect(state: GameState, event: GameEvent, rng: Rng): void {
  const s = actorById(state, event.actorId);
  if (!s) return;
  const hide = event.kind === 'hide';
  const vanish = !!event.vanish;
  const zone = zoneById(state, s.zone);
  const skill = vanish ? SK.vanishing : stealthSkill(s, event);
  const mine = (sk: string, sense: Sense) => hiderRoll(state, s, sk, sense, hide);
  const theirs = (a: Actor, sense: Sense) => watcherRoll(state, a, sense, zone);
  // one contest per observer per turn (ST4): a Vanish or a shot is not tested again by the turn's later events
  const done = contestedThisTurn(state);
  let saw = 0, lost = 0; // a player's Vanish: those who saw them, and those it lost (N2)
  for (const a of allActors(state)) {
    const key = pairKey(s, a);
    if (a.id === s.id || a.bandId === s.bandId || (!a.mind && a.kind !== 'player') || !isActive(a) || done.ids.includes(key)) continue;
    const cur = beliefStatus(state, a, s);
    const sees = atLeast(cur, 'aware');
    if (sees && !vanish) continue; // ST12: Hide and Sneak never shake off someone who sees you
    const seen = perceptionOf(event, state, a);
    if (!seen) continue;
    const sense = seen.cue === 'sound' ? FN.hearing : FN.sight;
    const r = ruleset.contested(mine(skill, sense), theirs(a, sense), state, rng);
    done.ids.push(key);
    if (sees) saw++;
    contestFeat(state, r, a.kind === 'player' ? [sense] : undefined); // N4c
    if (a.kind === 'player' && !sees && r.gap > 0) { tally(state, 'spotted'); tally(state, 'spotted', { by: 'function', of: sense }); } // N3
    markUse(state, s, skill, r); // ST8
    markUse(state, a, r.b.skill, r); // the watcher's sense learns too (only the player keeps marks)
    log(state, 'stealth_contest', { ...(s.kind === 'player' ? {} : { actorId: s.id }), observerId: a.id, skill, kind: event.kind, gap: r.gap });
    if (r.gap > 0) updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: s.id, status: 'aware', event });
    else if (sees) {
      if (r.gap >= 0) continue;
      // ST23: an observer with Unblinking who loses the Vanish still needs beating with Sneaking or Combat Stealth
      if (hasPerk(a, PK.unblinking)) {
        const second = stealthSkill(s);
        const r2 = ruleset.contested(mine(second, sense), theirs(a, sense), state, rng);
        contestFeat(state, r2, a.kind === 'player' ? [sense] : undefined);
        markUse(state, s, second, r2);
        markUse(state, a, r2.b.skill, r2);
        log(state, 'stealth_contest', { ...(s.kind === 'player' ? {} : { actorId: s.id }), observerId: a.id, skill: second, kind: event.kind, gap: r2.gap, perk: PK.unblinking });
        if (r2.gap >= 0) continue;
      }
      updateBeliefs(state, { kind: 'lost', observerId: a.id, aboutId: s.id, zone: event.fromZone });
      lost++;
    } else if (r.gap === 0 || (event.kind === 'attack' && event.target === a.id)) updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: s.id, status: 'suspicious', event });
  }
  if (vanish && s.kind === 'player' && saw && lost === saw) tally(state, 'vanished'); // N2: everyone who saw you lost you
}

/** SE21/SE24: the actor's effective skill with one sense (a function roll's best skill) */
const senseSkill = (state: GameState, a: Actor, sense: Sense): number => effectiveSkill(state, a, SENSE_SKILL[sense], { fullValue: rollFnSkills(a, sense) }).value;
/** SE20/SE21/SE24/SA8: the m² one search covers: SEARCH_AREA_M2 × the rolling skill ÷ SEARCH_AREA_SKILL_BASE, + the owner's
 * searchArea %, + SEARCH_M2_PER_FIGHT_M m² per metre of searchReach (perks and achievements; every source adds up) */
export const searchAreaM2 = (a: Actor, skill: number): number =>
  Math.max(0, CONFIG.SEARCH_AREA_M2 * skill / CONFIG.SEARCH_AREA_SKILL_BASE * (1 + rewardSum(a, 'searchArea') / 100) + rewardSum(a, 'searchReach') * CONFIG.SEARCH_M2_PER_FIGHT_M);
/** SE1/SE20: `h` is in what a search by `a` covers: the searcher's own area, all of it when it is no bigger than the search
 * area, else the search area around the searcher; a fight turn only area ÷ SEARCH_M2_PER_FIGHT_M metres around it (SA8 b) */
function inSearch(state: GameState, a: Actor, h: Located, area: number): boolean {
  if (h.zone !== a.zone) return false;
  if (state.mode === 'tactical') return withinM(distM(state, a, h), area / CONFIG.SEARCH_M2_PER_FIGHT_M);
  const z = zoneById(state, a.zone);
  return (z?.area ?? (z?.rect ? z.rect.w * z.rect.d : Infinity)) <= area || withinM(distM(state, a, h), Math.sqrt(area / Math.PI));
}

/** SE2 b, SE3, SE5, SE14, SE16: a search, by anyone, is a contest of the searcher's better sense after light against the
 * stealth (hide tag included) of everyone stealthy in reach whom it doesn't already see: a win makes it aware, a tie
 * suspicious, a loss changes nothing. Nobody hidden in reach: nothing is rolled (SE6). It always rolls, even after a
 * passive contest this turn, and counts as that pair's contest (SE5). `look`: the player's Look around with that sense,
 * a search out to the look's range, LOOK_SEARCH_SHIFT tiers down (SE14). `only`: a search aimed at one person. Returns
 * the contests the searcher won, with who it found. */
export function searchFor(state: GameState, a: Actor, event: GameEvent, rng: Rng, opts: { look?: Sense; only?: string } = {}): { found: Actor; r: ContestResult }[] {
  const here = zoneById(state, a.zone);
  const after = (sense: Sense) => CONFIG.SKILL_WEIGHT * senseSkill(state, a, sense) + watcherRoll(state, a, sense, here).modifiers.reduce((n, m) => n + m.value, 0);
  const sense: Sense = opts.look ?? (after(FN.hearing) > after(FN.sight) ? FN.hearing : FN.sight);
  const area = searchAreaM2(a, senseSkill(state, a, sense));
  const reaches = (h: Actor) => opts.look ? ((d) => d !== null && withinM(d, CONFIG.SIGHT_M.normal![0]))(seeingM(state, a, h)) : inSearch(state, a, h, area);
  const done = contestedThisTurn(state);
  const won: { found: Actor; r: ContestResult }[] = [];
  for (const h of allActors(state)) {
    if (h.id === a.id || h.posture !== 'stealthy' || h.bandId === a.bandId || !isActive(h) || (opts.only && h.id !== opts.only)) continue;
    if (atLeast(beliefStatus(state, a, h), 'aware') || !reaches(h)) continue;
    const w = watcherRoll(state, a, sense, zoneById(state, h.zone));
    const r = ruleset.contested(hiderRoll(state, h, stealthSkill(h), sense, true), opts.look ? { ...w, tierShifts: [...w.tierShifts, { source: 'look around', value: CONFIG.LOOK_SEARCH_SHIFT }] } : w, state, rng);
    if (!done.ids.includes(pairKey(h, a))) done.ids.push(pairKey(h, a));
    contestFeat(state, r, a.kind === 'player' ? [sense] : undefined); // N4c
    if (a.kind === 'player' && r.gap > 0) { tally(state, 'spotted'); tally(state, 'spotted', { by: 'function', of: sense }); } // N3
    markUse(state, h, r.a.skill, r);
    markUse(state, a, r.b.skill, r);
    log(state, 'search_contest', { actorId: a.id, hiderId: h.id, gap: r.gap, ...(opts.look ? { look: true } : {}) });
    const at = { ...event, zone: h.zone, ...(h.pos ? { pos: { ...h.pos } } : {}) };
    if (r.gap > 0) { updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: h.id, status: 'aware', event: at }); won.push({ found: h, r }); }
    else if (r.gap === 0) updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: h.id, status: 'suspicious', event: at });
  }
  return won;
}

/** a sight function roll by `a` in the light at `at` (SE2: a search looks for things by sight) */
function sightRoll(state: GameState, a: Actor, at: Zone | undefined, rng: Rng): RollResult {
  return ruleset.roll({ actorId: a.id, skill: SENSE_SKILL[FN.sight], ...situational(state, fnRoller(state, a, FN.sight), { light: at, actor: a }), fn: FN.sight, rollKind: 'perception' }, state, rng);
}
/** SE8: one sight roll against every hidden ground item in reach that the searcher doesn't know of: beating an item's
 * hidden-at tier finds it, the same tier only hints that something here was moved, below it nothing. Nothing hidden: no
 * roll (SE6). */
export function searchItems(state: GameState, a: Actor, rng: Rng): { r?: RollResult; found: ItemInstance[]; hint: boolean } {
  const z = zoneById(state, a.zone);
  const area = searchAreaM2(a, senseSkill(state, a, FN.sight));
  const hidden = (z?.groundItems ?? []).filter((i) => hiddenFrom(i, a) && inSearch(state, a, { zone: a.zone, ...(i.at ? { pos: i.at } : {}) }, area));
  if (!hidden.length) return { found: [], hint: false };
  const r = sightRoll(state, a, z, rng);
  const found = hidden.filter((i) => tierLevel(r) > tierLevel(i.hiddenAt!));
  for (const i of found) (i.knownTo ??= []).push(a.id);
  log(state, 'search_items', { actorId: a.id, tier: r.tier, hidden: hidden.length, found: found.length });
  return { r, found, hint: !found.length && hidden.some((i) => tierLevel(r) === tierLevel(i.hiddenAt!)) };
}
/** SE11: patting someone down needs their consent or force: within grip reach of someone down, asleep, surrendered or
 * held by the searcher */
export const handsOn = (state: GameState, a: Actor, t: Actor): boolean =>
  withinGrip(state, a, t) && (!isActive(t) || isAsleep(t) || t.mind?.moraleState === 'surrendered' || t.heldBy === a.id);
/** what `a` has found of someone's gear ('item:<instance id>'): the player's journal, an NPC's belief */
export const revealedTo = (a: Actor, about: string): string[] => (a.kind === 'player' ? a.journal?.revealed : a.mind?.knowledge[about]?.revealed) ?? [];
/** SE11: searching a person. Hands-on finds all their gear, concealed and stowed, with no roll; anyone else is only looked
 * over: one sight roll against each concealed item they wear, found when it beats the item's hidden-at tier. Nothing to
 * find: no roll. What is found is revealed to the searcher. */
export function searchPerson(state: GameState, a: Actor, t: Actor, rng: Rng): { r?: RollResult; found: ItemInstance[] } {
  const known = revealedTo(a, t.id);
  const unknown = t.core.inventory.filter((i) => !known.includes(`item:${i.id}`));
  let r: RollResult | undefined, found: ItemInstance[];
  if (handsOn(state, a, t)) found = unknown.filter((i) => itemDef(state, i.itemId).concealed || !i.equippedIn?.length);
  else {
    const hidden = unknown.filter((i) => i.equippedIn?.length && itemDef(state, i.itemId).hiddenAt);
    if (!hidden.length) return { found: [] };
    const roll = r = sightRoll(state, a, zoneById(state, t.zone), rng);
    found = hidden.filter((i) => tierLevel(roll) > TIERS.pos(itemDef(state, i.itemId).hiddenAt!));
  }
  for (const i of found) {
    if (a.kind === 'player') ((a.journal ??= { secretsKnown: [], factsWitnessed: [], remembered: {} } as never).revealed ??= []).push(`item:${i.id}`);
    else updateBeliefs(state, { kind: 'reveal', observerId: a.id, aboutId: t.id, fact: `item:${i.id}` });
  }
  return { ...(r ? { r } : {}), found };
}

export function detectPlayer(state: GameState, event: GameEvent, rng: Rng): void {
  if (state.player.posture === 'stealthy') return stealthDetect(state, event, rng);
  for (const a of state.actors) {
    if (!a.mind || !isActive(a)) continue;
    const cur = a.mind.knowledge.player?.status ?? 'unaware';
    if (atLeast(cur, 'aware')) continue;
    // Observers unaware of the player are left out of event.perception (they perceive the player only through detection),
    // so detection reads the perception level directly.
    const level = event.perception[a.id]?.level ?? perceptionOf(event, state, a)?.level;
    if (!level) continue;
    const status = level === 'full' ? 'aware' : 'suspicious';
    if (status === cur) continue;
    updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: 'player', status, event });
  }
}

/** the attack skill for the weapon used (ambush skill; OQ-4 settled: every attack on an unaware actor rolls). */
function ambushSkill(state: GameState, attacker: Actor, itemId: string | undefined): string {
  const used = itemId ? usableModes(state, attacker).find((m) => m.itemId === itemId) : undefined;
  const m = used ?? defaultMode(state, attacker, 0);
  if (m) return modeSkill(m.mode);
  const tpl = attacker.core.templateId ? npcTemplate(state, attacker.core.templateId) : undefined;
  return tpl?.fallback?.attackSkill ?? actorBody(state, attacker).fallback.attackSkill;
}

export function resolveAmbush(state: GameState, attackerId: string, targetId: string, attackEvent: GameEvent, rng: Rng): { surprised: boolean } {
  const attacker = actorById(state, attackerId);
  if (!attacker) return { surprised: false };
  // GAP: perception before the blow: use the event's if already computed, else compute it now.
  // Every active NPC that could perceive the attack, including those unaware of the attacker (left out of computePerception).
  const perception: GameEvent['perception'] = Object.keys(attackEvent.perception).length ? { ...attackEvent.perception } : { ...computePerception(attackEvent, state, rng) };
  for (const o of state.actors) {
    if (perception[o.id] || o.id === attackerId) continue;
    const seen = perceptionOf(attackEvent, state, o);
    if (seen) perception[o.id] = seen;
  }
  const ids = [targetId, ...Object.keys(perception).filter((id) => id !== targetId && id !== attackerId).sort()];
  const observers = ids
    .map((id) => actorById(state, id))
    .filter((o): o is Actor => !!o && isActive(o) && !atLeast(beliefStatus(state, o, attacker), 'aware')); // NS6: the player too
  if (!observers.length) return { surprised: false };
  const ambush: RollResult = ruleset.roll({ actorId: attackerId, skill: ambushSkill(state, attacker, attackEvent.itemId), modifiers: [], tierShifts: [], itemId: attackEvent.itemId }, state, rng);
  let surprised = false;
  const target = actorById(state, targetId);
  const spar = !!target && sparring(state, attacker, target); // SP11: a sparring blow from hiding raises no alarm
  for (const o of observers) {
    const skill = perception[o.id]?.cue === 'sound' ? FN.hearing : FN.sight;
    const p = ruleset.roll({ actorId: o.id, skill: SENSE_SKILL[skill], modifiers: [], tierShifts: [], rollKind: 'perception', fn: skill }, state, rng); // function roll
    const gap = tierLevel(p) - tierLevel(ambush); // Part 1 §4 Contests: acting side wins below 0
    // the watcher's sense learns from the ambush contest (only the player keeps marks)
    markUse(state, o, p.skill, { a: ambush, b: p, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' });
    if (o.id === targetId && gap < 0) surprised = true;
    // ST7: a shot from stealth leaves noticing to the stealth contest (stealthDetect); a melee blow has already revealed
    if (gap > 0 && attacker.posture !== 'stealthy') {
      updateBeliefs(state, { kind: 'detection', observerId: o.id, aboutId: attackerId, status: 'aware', event: attackEvent });
      if (o.kind !== 'player' && !spar) raiseAlarm(state, o);
    }
  }
  return { surprised };
}
