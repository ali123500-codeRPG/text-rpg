// State-side minds work: routine install and switch, the alarm machine, Explore detection and ambush.
import { groundZoneOf } from '../engine/ground';
import { FN } from '../library/functionIds';
import type { Actor, ActorView, ContestResult, Cue, GameEvent, GameState, ItemInstance, Order, Rng, RollResult, SkillFunction, Tier, TierRoll, Zone } from '../types';
import type { NoiseKey } from '../scales';
import { TIERS } from '../scales';
import { getLibrary, itemDef, perkName } from '../library';
import { hiddenFrom } from '../engine/gear';
import { CONFIG } from '../config';
import { now, pitchBlack, secondsSince, timeOfDay, zoneLight } from '../time';
import { routine as getRoutine, routineSet } from '../library';
import { actorById, allActors, atLeast, isActive, isAsleep, isEngaged, sparring, wary, zoneById } from '../engine/relations';
import { beliefStatus, hearsClearly, inLookReach, perceptionOf, sensesReaching, smells, updateBeliefs } from '../perception';
import { soundDb, VOLUME_NOISE } from '../perception/noise';
import { markUse, ruleset, situational, fnRoller, tierLevel, effectiveSkill } from '../ruleset';
import { coverShown, rollFnSkills } from '../ruleset/gear';
import { rewardSources } from '../ruleset/achRewards';
import { distM, seeingM, sightDistM, withinGrip, withinM, type Located } from '../engine/position';
import { hasPerk, meltAwayHere, perkSum } from '../ruleset/perks';
import { blindSpotNow } from '../engine/perkMarks';
import { fightingWith } from '../engine/engagement';
import { bindTemplate, expandSteps, HEAD_TO, offeredRoutines, slotsRead } from './routines';
import { DETECTION_SENSES, SK, SENSE_SKILL, type Sense } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { contestFeat, matchedCritFeat, outmatchedOnce, type ActContest } from '../engine/feats';
import { tally } from '../engine/xp';
import { journalOf } from '../engine/trail';
import { carriedContents } from '../engine/containers';
import { pointedShift, spotted } from '../engine/ruses';

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
  const stops = r.kind === 'schedule' ? expandSteps(r, mind.slots, timeOfDay(at), actor.zone) : [];
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
  const onStage = !!zoneById(state, dest) || state.openings.some((o) => o.frontier && o.joins[1] === dest);
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

/** BF11: an NPC its own agent moved somewhere stays there while it holds (AGENT_STAY_S): no routine walk, no catch-up */
export const staying = (state: GameState, a: Actor): boolean => !!a.mind?.stay && a.mind.stay.zone === a.zone && secondsSince(state, a.mind.stay.since) < CONFIG.AGENT_STAY_S;

/** NW2: a head_to walk that got where it was going goes back to the routine it had, from there (end of turn) */
export function headArrivals(state: GameState): void {
  for (const a of state.actors) {
    const m = a.mind;
    if (m?.routine?.id !== HEAD_TO) continue;
    const dest = m.slots?.dest;
    if ((Array.isArray(dest) ? dest[0] : dest) !== a.zone) continue;
    // BF4: leading someone, it waits there until they come or LEAD_WAIT_S pass
    // BG-308: it waits until the one it leads is near enough to talk (hears a normal voice), not until it is in the same zone
    const led = m.leading && actorById(state, m.leading.id);
    if (m.leading && (!led || !hearsClearly(state, led, a, VOLUME_NOISE.normal)) && secondsSince(state, m.leading.since ??= state.turn) < CONFIG.LEAD_WAIT_S) continue;
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

/**
 * Calm bandmates [Proposed] (Dialogue turn rules): when a spokesperson's output switches its routine, calm, code-run
 * bandmates who perceived the exchange switch to the same routine. The one rule for this; the engine calls it.
 * Calm means not engaged, no alarm armed, and no attack or alarm perceived within DECAY_AWARE_S (CS2).
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
  return !isEngaged(state, a) && !alarm?.armed && secondsSince(state, last) >= CONFIG.DECAY_AWARE_S;
}

const ALARM_KINDS = new Set(['attack', 'alarm', 'struck', 'found_body', 'impact']);
/** BF65: kinds that alarm their own actor too: the one struck unseen, the one who finds a body; BG-251: the one a missile lands by */
const SELF_ALARM = new Set(['struck', 'found_body', 'impact']);

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
    const perceivedAlarm = events.some((e) => (e.actorId !== a.id || SELF_ALARM.has(e.kind)) && ALARM_KINDS.has(e.kind) && !e.spar && !!e.perception[a.id]); // SP11: a spar raises no alarm
    const leftUnaware = knowsWary(state, a);
    if (perceivedAlarm || (leftUnaware && !a.mind.alarm?.armed)) {
      raiseAlarm(state, a);
      continue;
    }
    const alarm = a.mind.alarm;
    if (!alarm?.armed || (alarm.lastAlarmTurn !== undefined && secondsSince(state, alarm.lastAlarmTurn) < CONFIG.DECAY_AWARE_S)) continue; // BF1: armed from the start has no alarm to wait out
    // calm: back to the saved routine with its saved anchor
    if (alarm.returnTo) {
      a.mind.routine = { ...alarm.returnTo };
      delete alarm.returnTo;
    }
    // the routine return uses the timer only (Alarm); the armed flag also waits until they know of no wary actor (Hidden state persistence, CS2)
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

/** the sense a perception cue rolls (a stealth contest, an ambush): smell rolls Scent (AB18), sound hearing, else sight */
const cueSense = (cue: Cue | undefined): Sense => (cue === 'sound' ? FN.hearing : cue === 'smell' ? FN.smell : FN.sight);
/** Every Sense One: the senses it makes one */
const ONE_SENSE: Sense[] = [FN.sight, FN.hearing];
const sumMods = (ms: { value: number }[]) => ms.reduce((n, m) => n + m.value, 0);
/** the hider's stealth roll against one sense. ST21/ST22: light and cover reach it by situation tag; staying put
 * (a sneak that stays put with Melt Away or Strike and Fade, or hiding from a search) ignores leg wounds (ST10). P14: darkness never hurts hearing, so it gives no help against one who only hears.
 * All-50 Hushed Steps: the owner's Sneaking Near Miss counts as a Success against one who only hears. */
function hiderRoll(state: GameState, s: Actor, sk: string, sense: Sense, still: boolean, watcher?: Actor) {
  const zone = zoneById(state, s.zone);
  const hushed = sk === SK.sneaking && sense === FN.hearing && hasPerk(s, PK.hushed_steps) ? { nearMissUp: perkName(PK.hushed_steps) } : {};
  return { actorId: s.id, skill: sk, ...situational(state, sk, { light: sense === FN.sight ? zone : undefined, cover: zone, actor: s, body: s, from: watcher }), rollKind: 'stealth' as const, ...(still ? { roles: [] } : {}), ...hushed };
}
/** the watcher's sense roll in the light where the hider is: a function roll, the best sight (or hearing) skill at full value */
function watcherRoll(state: GameState, a: Actor, sense: Sense, light: Zone | undefined, hider?: Actor) {
  const sit = situational(state, fnRoller(state, a, sense), { light, actor: a });
  // WN4 b: a hider an ally pointed out is easier to notice, once (the shift is spent by this roll)
  const pointed = hider ? pointedShift(state, a, hider) : [];
  return { actorId: a.id, skill: SENSE_SKILL[sense], ...sit, ...(pointed.length ? { tierShifts: [...(sit.tierShifts ?? []), ...pointed] } : {}), rollKind: 'perception' as const, fn: sense };
}
/** ST4/SE5, D-40: this turn's stealth contests, one per hider, watcher and sense (`key:sense`) */
function contestedThisTurn(state: GameState): { turn: number; ids: string[] } {
  const sc = (state.scratch ??= {});
  const done = (sc.stealthContested as { turn: number; ids: string[] } | undefined)?.turn === state.turn ? (sc.stealthContested as { turn: number; ids: string[] }) : { turn: state.turn, ids: [] };
  sc.stealthContested = done;
  return done;
}
const pairKey = (s: Actor, a: Actor) => (s.kind === 'player' ? a.id : `${s.id}>${a.id}`);

/** ST3–ST8, ST11–ST19, NS1–NS5, VS1–VS5: while an actor is stealthy, every observer outside its band who could perceive the
 * event rolls each detection sense that reaches it (D-40: sight, hearing, smell, each on its own) against the actor's
 * stealth, each sense once per turn (ST4). Felt only (a blow from the unseen): sight, as the cue says. With Every Sense
 * One, sight and hearing are one contest, rolled as whichever set-up nets the watcher more. The player is an observer like
 * any other (NS3); NPCs contest each other too (NS5).
 * - An observer not aware of the actor rolls against its Sneaking (Combat Stealth in an engagement or for an attack, ST2).
 *   A win on any sense: aware. Else a tie on any: suspicious. A shot's target that loses still turns suspicious, at the
 *   shooter's zone (ST19).
 * - An observer aware of it rolls against its Vanishing (VS1), only when the actor moves (any step), or stays put with Melt
 *   Away where cover or shade allows (VS2; Blind Spot: no cover needed). Only when every sense loses does it lose the
 *   actor and drop to suspicious where it last saw it (ST15); any sense that wins or ties keeps it. A foe fighting the
 *   actor within VANISH_NEAR_M makes it harder (VS5). With Unblinking, a sense that loses must also lose a Sneaking or
 *   Combat Stealth contest (ST23).
 * - Strike and Fade (VS3): right after an attack from hiding, each observer the attack made aware (`event.spotted`) rolls
 *   against Vanishing at once, in place with no cover needed: the one second roll a watcher makes in a turn.
 * Light and cover reach the rolls by situation tag (CONFIG.SITUATION_TAGS, ST21); staying put ignores leg wounds (ST10). */
export function stealthDetect(state: GameState, event: GameEvent, rng: Rng): string[] {
  const madeAware: string[] = [];
  const s = actorById(state, event.actorId);
  if (!s) return madeAware;
  const zone = zoneById(state, s.zone);
  const fade = event.kind === 'vanish'; // Strike and Fade
  const moved = event.kind === 'move';
  const melt = !moved && !fade && event.kind !== 'attack' && hasPerk(s, PK.melt_away) && !!zone && (blindSpotNow(state, s) || meltAwayHere(coverShown(state, s, zone), zoneLight(state, zone, s.pos)));
  const still = fade || melt;
  const from: Located = { zone: event.fromZone ?? s.zone, pos: event.fromPos ?? s.pos };
  const mine = (sk: string, sense: Sense, a?: Actor) => hiderRoll(state, s, sk, sense, still, a);
  const theirs = (a: Actor, sense: Sense) => watcherRoll(state, a, sense, zone, s);
  // VS5: slipping away from a foe that is fighting you within VANISH_NEAR_M is harder (by distance, not weapon reach)
  // LG15 In the Thick of It (Vanishing 40): not for its owner
  const near = (a: Actor) => !hasPerk(s, PK.thick_of_it) && fightingWith(state, a, s) && withinM(distM(state, from, a), CONFIG.VANISH_NEAR_M);
  // one contest per observer and sense per turn (ST4, D-40): later events of the turn are not tested again by that sense.
  // BG-263: a shot (any attack while stealthy) keeps its own contests, so a step earlier in the turn never stands in for its
  // Combat Stealth roll; the shot's contests still count for the turn's later events. VS3: Strike and Fade's are its own too.
  const done = contestedThisTurn(state);
  const own = event.kind === 'attack' ? ':shot' : fade ? ':fade' : '';
  let saw = 0, lost = 0; // a player's Vanishing rolls: those who saw them, and those it lost (N2)
  // CS25: an attack (an ambush) is one stealth act: Against the Odds counts once, for the strongest watcher beaten
  const act: ActContest[] | undefined = event.kind === 'attack' ? [] : undefined;
  const feat = (r: ContestResult, fns?: SkillFunction[]) => { if (act) { matchedCritFeat(state, r); act.push({ c: r, fns }); } else contestFeat(state, r, fns); }; // N4c
  for (const a of allActors(state)) {
    const pair = pairKey(s, a) + own;
    if (a.id === s.id || a.bandId === s.bandId || (!a.mind && a.kind !== 'player') || !isActive(a)) continue;
    const sees = atLeast(beliefStatus(state, a, s), 'aware');
    if (fade ? !sees || !event.spotted?.includes(a.id) : sees && !moved && !melt) continue; // ST12: no slipping away without a step or Melt Away
    const seen = perceptionOf(event, state, a);
    if (!seen) continue;
    const skill = sees ? SK.vanishing : stealthSkill(s, event);
    const reaching = sensesReaching(event, state, a);
    const tests = (reaching.length ? reaching : [cueSense(seen.cue)]).filter((f) => !done.ids.includes(`${pair}:${f}`)).map((f): { sense: Sense; stands: Sense[] } => ({ sense: f, stands: [f] }));
    if (hasPerk(a, PK.one_sense) && tests.some((t) => ONE_SENSE.includes(t.sense))) {
      // Every Sense One: sight and hearing are one contest, rolled as whichever set-up nets the watcher more (sight on a tie)
      const net = (f: Sense) => sumMods(watcherRoll(state, a, f, zone).modifiers) - sumMods(mine(skill, f, a).modifiers);
      tests.splice(0, tests.length, ...tests.filter((t) => !ONE_SENSE.includes(t.sense)), { sense: net(FN.sight) >= net(FN.hearing) ? FN.sight : FN.hearing, stands: ONE_SENSE });
    }
    if (!tests.length) continue;
    let won: Sense | undefined, held = false;
    for (const { sense, stands } of tests) {
      const roll = mine(skill, sense, a);
      if (sees && near(a)) roll.tierShifts = [...roll.tierShifts, { source: 'foe close by', value: CONFIG.VANISH_NEAR_SHIFT }];
      const r = ruleset.contested(roll, theirs(a, sense), state, rng);
      for (const f of stands) {
        done.ids.push(`${pair}:${f}`);
        if (own === ':shot') done.ids.push(`${pairKey(s, a)}:${f}`);
      }
      feat(r, a.kind === 'player' ? [sense] : undefined);
      markUse(state, s, skill, r); // ST8
      markUse(state, a, r.b.skill, r); // the watcher's sense learns too (only the player keeps marks)
      log(state, 'stealth_contest', { ...(s.kind === 'player' ? {} : { actorId: s.id }), observerId: a.id, skill, sense, kind: event.kind, gap: r.gap });
      if (r.gap > 0) won ??= sense;
      else if (r.gap === 0) held = true;
      else if (sees && hasPerk(a, PK.unblinking)) {
        // ST23: an observer with Unblinking whose sense loses the Vanishing roll still needs beating with Sneaking or Combat Stealth
        const second = stealthSkill(s);
        const r2 = ruleset.contested(mine(second, sense, a), theirs(a, sense), state, rng);
        feat(r2, a.kind === 'player' ? [sense] : undefined);
        markUse(state, s, second, r2);
        markUse(state, a, r2.b.skill, r2);
        log(state, 'stealth_contest', { ...(s.kind === 'player' ? {} : { actorId: s.id }), observerId: a.id, skill: second, sense, kind: event.kind, gap: r2.gap, perk: PK.unblinking });
        if (r2.gap >= 0) held = true;
      }
    }
    if (sees) saw++;
    else if (won || held) done.ids.push(`${pair}:held`); // an ambush's target that noticed anything is not caught off guard (resolveAmbush)
    if (won) {
      if (a.kind === 'player' && !sees) { tally(state, 'spotted'); tally(state, 'spotted', { by: 'function', of: won }); } // N3
      updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: s.id, status: 'aware', event }); spotted(a, s); // WN8
      madeAware.push(a.id);
    } else if (sees) {
      if (held) continue; // VS1, D-40: any sense still holding on keeps them
      updateBeliefs(state, { kind: 'lost', observerId: a.id, aboutId: s.id, zone: from.zone });
      lost++;
    } else if (held || (event.kind === 'attack' && event.target === a.id)) updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: s.id, status: 'suspicious', event });
  }
  if (s.kind === 'player' && saw && lost === saw) tally(state, 'vanished'); // N2: everyone who saw you lost you
  if (act) outmatchedOnce(state, act);
  return madeAware;
}

/** SE21/SE24: the actor's effective skill with one sense (a function roll's best skill) */
const senseSkill = (state: GameState, a: Actor, sense: Sense): number => effectiveSkill(state, a, SENSE_SKILL[sense], { fullValue: rollFnSkills(a, sense) }).value;
/** SE21/SE24, LS9: the m² one search covers: the circle of SEARCH_RADIUS_AT_0_M doubled every SEARCH_RADIUS_DOUBLING points of
 * the rolling skill, × the owner's searchArea %, + SEARCH_M2_PER_REACH_M m² per metre of searchReach (perks and
 * achievements; every source adds up) */
export const searchAreaM2 = (a: Actor, skill: number): number => searchAreaParts(a, skill).areaM2;
/** searchAreaM2 with its terms: the skill's base m², each searchArea % and searchReach m by source */
function searchAreaParts(a: Actor, skill: number) {
  const baseM2 = Math.PI * (CONFIG.SEARCH_RADIUS_AT_0_M * 2 ** (skill / CONFIG.SEARCH_RADIUS_DOUBLING)) ** 2;
  const areaPct = rewardSources(a, 'searchArea'), reachM = rewardSources(a, 'searchReach');
  const sum = (xs: { value: number }[]) => xs.reduce((n, x) => n + x.value, 0);
  return { baseM2, areaPct, reachM, areaM2: Math.max(0, baseM2 * (1 + sum(areaPct) / 100) + sum(reachM) * CONFIG.SEARCH_M2_PER_REACH_M) };
}
/** SE21/SE24, LX2/LX5, D-411: what one sense of a search by `a` covers (each sense has its own, LS1 a): that sense's
 * effective skill, the area with its terms, its radius and ring one's */
export function searchReach(state: GameState, a: Actor, sense: Sense = FN.sight) {
  const skill = senseSkill(state, a, sense), parts = searchAreaParts(a, skill), radiusM = searchRadiusM(parts.areaM2);
  return { sense, skill, ...parts, radiusM, ring1M: CONFIG.SEARCH_RING1_RADII * radiusM };
}
/** SE1, PZ11 a, BG-314 (BF100 b), LX2/LX3: `h` is in what a search by `a` covers: the search area's circle round the
 * searcher, the same in a fight and out of one, never under SEARCH_MIN_RADIUS_M, in a clear line, whatever title either
 * stands in */
function inSearch(state: GameState, a: Actor, h: Located, area: number): boolean {
  return searchSees(state, a, h, searchRadiusM(area));
}
const searchRadiusM = (area: number): number => Math.max(CONFIG.SEARCH_MIN_RADIUS_M, Math.sqrt(area / Math.PI));
/** BG-314: the sight part of a search's reach: a clear line from `a` to `h`, within `r` metres */
export const searchSees = (state: GameState, a: Actor, h: Located, r: number): boolean => withinM(sightDistM(state, a, h), r);

/** D-411 (LS1–LS3, LS7, LS8): what one sense of a Search reaches of `h`, as the tiers that sense's test takes, or null.
 * Each sense has its own search area (its own skill, SE21) and its own reach: sight a clear line out to the look's 25 m,
 * never in pitch black; hearing `h`'s own sound (its step, else HIDE_STILL_NOISE) carried to `a` above the hearing floor,
 * with Keen Ear and the dB that carry sound as much further as the circle has grown since skill 0 (LS3, LS9); smell its
 * usual reach (AB18). The same metres for every sense
 * (LS7 a): inside the sense's search radius SEARCH_AREA_SHIFT, out to SEARCH_RING1_RADII radii ring one, past it ring
 * two (LX5 b, LX8 a). A Pat down (`only`) takes none. Returns the shift, and whether `h` is past the sense's search area. */
function senseReach(state: GameState, a: Actor, h: Actor, sense: Sense, noise: NoiseKey, only: boolean): { shift: number; pastArea: boolean } | null {
  const { areaM2: area, radiusM: r, ring1M } = searchReach(state, a, sense);
  if (area <= 0) return null;
  // each sense's reach: the metres to `h`, or null (D-40: a new sense gives its reach here)
  const reach: Record<Sense, () => number | null> = {
    // LT1: nothing is seen in pitch black
    [FN.sight]: () => { if (pitchBlack(zoneLight(state, zoneById(state, h.zone), h.pos))) return null; const m = sightDistM(state, a, h); return inLookReach(m) ? m : null; },
    [FN.hearing]: () => ((soundDb(state, noise, h, a, perkSum(a, 'hearingDb') + 10 * Math.log10(area / (Math.PI * CONFIG.SEARCH_RADIUS_AT_0_M ** 2))) ?? -Infinity) >= CONFIG.HEARING_FLOOR_DB ? distM(state, a, h) : null),
    [FN.smell]: () => (smells(state, a, h) ? distM(state, a, h) : null),
  };
  const d = reach[sense]();
  if (d === null) return null;
  if (only) return { shift: 0, pastArea: false };
  return withinM(d, r) ? { shift: CONFIG.SEARCH_AREA_SHIFT, pastArea: false }
    : { shift: withinM(d, ring1M) ? CONFIG.SEARCH_RING_SHIFTS[0] : CONFIG.SEARCH_RING_SHIFTS[1], pastArea: true };
}

/** SE2 b, SE3, SE5, SE16, D-411: a search, by anyone, tests each sense that reaches a hider on its own (LS6): a contest of
 * that sense against the stealth (hide tag included) of everyone stealthy whom it doesn't already see. The best of them
 * counts: a win makes it aware (a find by sound too, LS4), a tie suspicious, a loss changes nothing. Nobody hidden in
 * reach: nothing is rolled (SE6). It always rolls, even after a passive contest this turn, and counts as the pair's
 * contest for each sense it tests (SE5, D-40), except a sense that reaches `h` only past its search area, in the rings:
 * that sense's passive contest still runs and the better counts, so a Search never finds less than waiting (LX8 a, WC1,
 * WC2). `noiseOf`: the sound each hider makes this turn (LS2). `only`: a Pat down, aimed at one person. `look`:
 * Look at or Listen, one sense out to the look's range, LOOK_SEARCH_SHIFT tiers down (SE14). Returns the contests the
 * searcher won, with who it found. */
export function searchFor(state: GameState, a: Actor, event: GameEvent, rng: Rng, opts: { look?: Sense; only?: string; noiseOf?: (h: Actor) => NoiseKey } = {}): { found: Actor; r: ContestResult }[] {
  const done = contestedThisTurn(state);
  const won: { found: Actor; r: ContestResult }[] = [];
  for (const h of allActors(state)) {
    if (h.id === a.id || h.posture !== 'stealthy' || h.bandId === a.bandId || !isActive(h) || (opts.only && h.id !== opts.only)) continue;
    if (atLeast(beliefStatus(state, a, h), 'aware')) continue;
    const noise = opts.noiseOf?.(h) ?? CONFIG.HIDE_STILL_NOISE;
    const reach = opts.look ? [] : DETECTION_SENSES.flatMap((f) => { const t = senseReach(state, a, h, f, noise, !!opts.only); return t === null ? [] : [{ sense: f, ...t }]; });
    const tests: [Sense, number][] = opts.look ? (inLookReach(seeingM(state, a, h)) ? [[opts.look, CONFIG.LOOK_SEARCH_SHIFT]] : []) : reach.map((t) => [t.sense, t.shift]);
    let best: { r: ContestResult; sense: Sense } | undefined;
    for (const [sense, shift] of tests) {
      const w = watcherRoll(state, a, sense, zoneById(state, h.zone), h);
      const r = ruleset.contested(hiderRoll(state, h, stealthSkill(h), sense, true, a), shift ? { ...w, tierShifts: [...w.tierShifts, { source: opts.look ? 'look around' : 'searching', value: shift }] } : w, state, rng);
      contestFeat(state, r, a.kind === 'player' ? [sense] : undefined); // N4c
      markUse(state, h, r.a.skill, r);
      markUse(state, a, r.b.skill, r);
      log(state, 'search_contest', { actorId: a.id, hiderId: h.id, gap: r.gap, sense, ...(opts.look ? { look: true } : {}) });
      if (!best || r.gap > best.r.gap) best = { r, sense };
    }
    if (!best) continue;
    // SE5, D-40: each sense tested is that sense's contest; WC2: a sense that reaches `h` only in its rings leaves that
    // sense's passive contest to run this turn, and the better counts
    for (const [f] of tests) if (!reach.some((t) => t.sense === f && t.pastArea) && !done.ids.includes(`${pairKey(h, a)}:${f}`)) done.ids.push(`${pairKey(h, a)}:${f}`);
    const r = best.r;
    if (a.kind === 'player' && r.gap > 0) { tally(state, 'spotted'); tally(state, 'spotted', { by: 'function', of: best.sense }); } // N3
    const at = { ...event, zone: h.zone, ...(h.pos ? { pos: { ...h.pos } } : {}) };
    if (r.gap > 0) { updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: h.id, status: 'aware', event: at }); spotted(a, h); won.push({ found: h, r }); } // WN8
    else if (r.gap === 0) updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: h.id, status: 'suspicious', event: at });
  }
  return won;
}

/** a sense function roll by `a` in the light at `at` (SE2: a search looks for things by sight) */
function senseRoll(state: GameState, a: Actor, fn: Sense, at: Zone | undefined, rng: Rng): RollResult {
  return ruleset.roll({ actorId: a.id, skill: SENSE_SKILL[fn], ...situational(state, fnRoller(state, a, fn), { light: at, actor: a }), fn, rollKind: 'perception' }, state, rng);
}
const sightRoll = (state: GameState, a: Actor, at: Zone | undefined, rng: Rng): RollResult => senseRoll(state, a, FN.sight, at, rng);
/** SE25 b table: the skill a hidden-at tier stands for when no one did the hiding */
export const tierSkill = (t: Tier | TierRoll): number =>
  Math.max(0, CONFIG.HIDDEN_TIER_SUCCESS_SKILL + CONFIG.HIDDEN_TIER_SKILL_STEP * (tierLevel(t) - TIERS.pos('success')));
/** SE25 a: an item search or a stash learns like a check against one number (marks stay invisible, SE7); `passed`: the
 * roll beat that number (PG2: a pass teaches however hard the number) */
export const markAgainst = (state: GameState, a: Actor, r: RollResult, opposition: number, passed: boolean): void =>
  markUse(state, a, r.skill, { actorId: a.id, skill: r.skill, ...(r.asked ? { asked: r.asked } : {}), target: opposition, passed, modifiers: [] });
/** SE25 a: a hidden item's level to learn against: its stasher's stealth skill, else its hidden-at tier on the table */
const hiddenLevel = (i: ItemInstance): number => i.hiderSkill ?? tierSkill(i.hiddenAt!);
/** SE8: one sight roll against every hidden ground item in reach that the searcher doesn't know of: beating an item's
 * hidden-at tier finds it, the same tier only hints that something here was moved, below it nothing. Nothing hidden: no
 * roll (SE6). */
export function searchItems(state: GameState, a: Actor, rng: Rng): { r?: RollResult; found: ItemInstance[]; hint: boolean } {
  const z = zoneById(state, a.zone);
  const area = searchAreaM2(a, senseSkill(state, a, FN.sight));
  const hidden = state.ground.filter((i) => { const zone = groundZoneOf(state, i); return !!zone && hiddenFrom(i, a) && inSearch(state, a, { zone, ...(i.at ? { pos: i.at } : {}) }, area); });
  if (!hidden.length) return { found: [], hint: false };
  const r = sightRoll(state, a, z, rng);
  const found = hidden.filter((i) => tierLevel(r) > tierLevel(i.hiddenAt!));
  for (const i of found) (i.knownTo ??= []).push(a.id);
  markAgainst(state, a, r, Math.max(...hidden.map(hiddenLevel)), found.length === hidden.length); // SE25: against the best-hidden thing searched for; passed when it was found too
  log(state, 'search_items', { actorId: a.id, tier: r.tier, hidden: hidden.length, found: found.length });
  return { r, found, hint: !found.length && hidden.some((i) => tierLevel(r) === tierLevel(i.hiddenAt!)) };
}
/** SE11: someone who can't stop a grip going through their things: down, dead, asleep, yielded, or held by `a` */
export const openToGrip = (state: GameState, a: Actor, t: Actor): boolean => !isActive(t) || isAsleep(t) || t.mind?.moraleState === 'surrendered' || t.heldBy === a.id
  || (t.letsSearch?.by === a.id && t.letsSearch.until >= state.turn); // BF16: or they let `a` search them
/** SE11: patting someone down needs their consent or force: within grip reach of someone open to a grip (above) */
export const gripOn = (state: GameState, a: Actor, t: Actor): boolean => withinGrip(state, a, t) && openToGrip(state, a, t);
/** BF16: letting someone search you hands-on, this turn and the next */
export function letSearch(state: GameState, a: Actor, by: string | null | undefined): void {
  if (by && by !== a.id && actorById(state, by)) a.letsSearch = { by, until: state.turn + 1 };
}

/** what `a` now knows `t` carries: the player's journal, an NPC's belief (SE11, BF16) */
export function revealItems(state: GameState, a: Actor, t: Actor, items: ItemInstance[]): void {
  for (const i of items) {
    if (a.kind === 'player') (journalOf(a).revealed ??= []).push(`item:${i.id}`);
    else updateBeliefs(state, { kind: 'reveal', observerId: a.id, aboutId: t.id, fact: `item:${i.id}` });
  }
}
/** what `a` has found of someone's gear ('item:<instance id>'): the player's journal, an NPC's belief */
export const revealedTo = (a: Actor, about: string): string[] => (a.kind === 'player' ? a.journal?.revealed : a.mind?.knowledge[about]?.revealed) ?? [];
/** SE11: searching a person. Hands-on finds all their gear, concealed and stowed, with no roll; anyone else is only looked
 * over: one sight roll against each concealed item they wear, found when it beats the item's hidden-at tier. Nothing to
 * find: no roll. What is found is revealed to the searcher. */
export function searchPerson(state: GameState, a: Actor, t: Actor, rng: Rng): { r?: RollResult; found: ItemInstance[] } {
  const known = revealedTo(a, t.id);
  const hands = gripOn(state, a, t);
  // BG-206 (BF29): hands on goes through the bags they carry too, unless locked
  const inside = hands ? carriedContents(state, t.core.inventory).map((x) => x.inst) : [];
  const unknown = [...t.core.inventory, ...inside].filter((i) => !known.includes(`item:${i.id}`));
  let r: RollResult | undefined, found: ItemInstance[];
  // BG-178: what one found before and is still there is found again; only new finds need hands on or a roll
  const hiddenGear = (i: ItemInstance) => !!i.equippedIn?.length && !!itemDef(state, i.itemId).hiddenAt;
  const again = [...t.core.inventory, ...inside].filter((i) => known.includes(`item:${i.id}`) && (hiddenGear(i) || !i.equippedIn?.length));
  if (hands) found = unknown.filter((i) => itemDef(state, i.itemId).concealed || !i.equippedIn?.length);
  else {
    const hidden = unknown.filter(hiddenGear);
    const roll = hidden.length ? (r = sightRoll(state, a, zoneById(state, t.zone), rng)) : undefined;
    found = hidden.filter((i) => roll && tierLevel(roll) > TIERS.pos(itemDef(state, i.itemId).hiddenAt!));
    if (roll) markAgainst(state, a, roll, Math.max(...hidden.map((i) => tierSkill(itemDef(state, i.itemId).hiddenAt!))), found.length === hidden.length); // SE25
  }
  revealItems(state, a, t, found);
  return { ...(r ? { r } : {}), found: [...again, ...found] };
}

/** SE17: a player's search aimed at someone also rolls, once per sense, for that person's unrevealed check_passed secrets
 * of a sight or hearing skill; each one the roll reaches (its minTier or better) is revealed. None of them: no roll. */
export function searchSecrets(state: GameState, a: Actor, t: Actor, rng: Rng): { r?: RollResult; found: string[] } {
  if (a.id !== state.player.id) return { found: [] }; // secrets are player knowledge
  const j = journalOf(a);
  const skills = getLibrary().skills, found: string[] = [];
  let r: RollResult | undefined;
  for (const fn of [FN.sight, FN.hearing] as Sense[]) {
    const ss = state.hidden.secrets.filter((s) => s.revealWhen.type === 'check_passed' && s.revealWhen.againstActorId === t.id &&
      !j.secretsKnown.includes(s.id) && !!skills[s.revealWhen.skill]?.functions.includes(fn));
    if (!ss.length) continue;
    const roll = senseRoll(state, a, fn, zoneById(state, t.zone), rng);
    const min = (s: (typeof ss)[number]) => (s.revealWhen as { minTier: Tier }).minTier;
    const got = ss.filter((s) => tierLevel(roll) >= TIERS.pos(min(s)));
    markAgainst(state, a, roll, Math.max(...ss.map((s) => tierSkill(min(s)))), got.length === ss.length); // SE25: a secret's minTier on the table
    if (got.length) { r = roll; found.push(...got.map((s) => s.id)); j.secretsKnown.push(...got.map((s) => s.id)); }
  }
  return { ...(r ? { r } : {}), found };
}

export function detectPlayer(state: GameState, event: GameEvent, rng: Rng): void {
  if (state.player.posture === 'stealthy') { stealthDetect(state, event, rng); return; }
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

/** OQ-4, BG-342: an attack on someone unaware of the attacker is an ambush. It rolls nothing of its own: the attack's own
 * Combat Stealth contests (stealthDetect, from hiding or not: one per sense that reaches each watcher, once per turn)
 * decide who notices, before the blow. The target is surprised when it rolled and every sense lost: a win or a tie on any
 * sense keeps it from being caught off guard, and a later blow in the same turn keeps that result. A watcher who wins
 * against an attacker not hidden (a melee blow shows it) is alarmed at once; a sparring blow alarms no one (SP11). */
export function resolveAmbush(state: GameState, attackerId: string, targetId: string, attackEvent: GameEvent, rng: Rng): { surprised: boolean } {
  const attacker = actorById(state, attackerId), target = actorById(state, targetId);
  if (!attacker || !target) return { surprised: false };
  const noticed = stealthDetect(state, attackEvent, rng);
  if (attacker.posture !== 'stealthy' && !sparring(state, attacker, target)) for (const id of noticed) { const o = actorById(state, id); if (o && o.kind !== 'player') raiseAlarm(state, o); }
  const pair = `${pairKey(attacker, target)}:shot`, done = contestedThisTurn(state);
  return { surprised: DETECTION_SENSES.some((f) => done.ids.includes(`${pair}:${f}`)) && !done.ids.includes(`${pair}:held`) };
}
