// The Resolution engine: one turn of pure resolution. Same state + same input + same rng = same events.
import { checkScenarioEnd, closeScenario } from './scenarioEnd';
import { checkRoam, updateChase } from './chase';
import { noteHappened } from './happened';
import { noteLeft, noteZonesSeen } from './trail';
import { heightOf } from '../scenario/heights';
import { DU, FR, HL, RL } from '../library/tableIds';
import { payFear } from './morale';
import { healthFear, moraleLevel, partFearCost, partFears } from '../ruleset/morale';
import { bestReward } from '../ruleset/achRewards';
import { parryItem } from '../ruleset/gear';
import { FN } from '../library/functionIds';
import type { Actor, ActorView, AttackResult, Barrier, CheckResult, ContestResult, GameEvent, GameState, GearOp, Mod, Order, Rng, TierShift, WayDid } from '../types';
import { barrierOn, noteTried, openWay, passage, shutBy, wayOp, type Passage } from './barriers';
import { CONFIG } from '../config';
import { activity, actorBody, getLibrary, itemDef, routine } from '../library';
import { slotMetres } from './speed';
import { travel, travelSpeed, tripGoal } from './travel';
import { distM, gateAhead, placeAll, sightDistM, spotOf, spotOnTheWay, spotPoint, walkLeg, wayLeftM, wayPoint, type Located } from './position';
import { applyHealing, healFromPerk, passiveHealing, wouldHeal } from './heal';
import { HEALTH_LEVELS, PART_STATES, TIERS } from '../scales';
import { defaultMode, effectiveSkill, gradeMod, pickSeconds, pickTool, hasPerk, meltAwayHere, healthLevel, isDownLevel, tierLevel, improveMarked, clearMarkCounts, markEndurance, modeSkill, partStates, ruleset, landFall, situational, fnRoller, survivalRoll, tierAtLeast, usableModes } from '../ruleset';
import { VOLUME_NOISE } from '../perception/noise';
import { applyBeliefDecay, beliefStatus, computePerception, hears, hearsWords, lookAround, noteSightings, noticeCue, stealthEnd, stealthStart, updateBeliefs } from '../perception';
import { buildActorView } from '../views';
import { alertOrders, brokenOrder, desiredState, detectPlayer, fallbackOrder, headArrivals, resolveAmbush, stealthDetect, updateAlarms } from '../minds';
import { noteFighting, updateEngagements, usableThisEngagement, useThisEngagement } from './engagement';
import { afterAttack, bluffed, coverFor, expireMarks, slowed } from './perkMarks';
import { battleCry, engagementAuras } from './auras';
import { grantAllSteps, shareSpotted } from '../ruleset/allSteps';
import { syncPerkLinks } from '../ruleset/perkLinks';
import { grantThreadboundItem, syncThreadboundItemPerks } from '../ruleset/threadboundItems';
import { applyHold, breakFree, releaseHolds } from './held';
import { armThreadboundItem, countPerkMove, freeHand, perkMoveBlock, resolvePerkMove } from './perkMoves';
import { actorById, allActors, atLeast, bandById, foe, isActive, isAsleep, isEngaged, hostile, reachesAcross, shortestPath, sparBetween, wayPath, zoneById } from './relations';
import { checkOut, endSparsOf, heldBack, sparOf, updateSpars, yieldSpar } from './spar';
import { NEEDS, fromIntent, mergeOrders, usableAgentOutputs } from './merge';
import { fireMidTurnTrigger, firedOrders } from './triggers';
import { checkSecrets } from './secrets';
import { applyGearOps, dropToGround, equipArmor, giveItem, gripReachM, improvise, pickUpAt, withinGrip } from './gear';
import { buy, sell } from './trade';
import { applyAgentEffects, learnNames, logCode } from './effects';
import { falseName } from '../words';
import { gutFeelings } from './hunches';
import { PUSH_TYPES, SPEECH_SKILL, applySpeech, isSpeech, overhearLie, pushContest } from './speech';
import { growthWaits, payDefeats, tally, unlockClasses } from './xp';
import { noteGains } from './growth';
import { expireOffers, offersFromDefeats } from './essence';
import { handInQuests, unpaidQuests, updateQuests } from './quests';
import { fightEnded, turnFeats } from './feats';
import { answerYield, playerYields, yieldBars } from './yield';
import { minutesUntil, nextTimeOfDay, now, timeOfDay, zoneLight } from '../time';
import { advanceAging } from '../ruleset/age';
import { NOISE, TIME_OF_DAY, type NoiseKey } from '../scales';
import type { TurnInput } from './types';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { met } from '../ruleset/hits';
import { applyNightPhase, hostilesNear, nextChange, planNight, settleSleepers, wakeByEvent, wakeCalls, wakeCheck, wakeChecksNear, wake } from './sleep';

// GAP: the spec sets no noise/visibility for engine-made events outside activities. Placeholders, not ruleset numbers.
const SENSE: Record<string, [GameEvent['noise'], GameEvent['visibility']]> = {
  travel: ['quiet', 'normal'], attack: ['normal', 'high'], wasted: ['normal', 'high'], move: ['quiet', 'normal'], hold: ['silent', 'low'], speak: ['normal', 'normal'], call_help: ['loud', 'normal'], battle_cry: ['loud', 'high'], alarm: ['deafening', 'high'],
  rest: ['silent', 'low'], item_dropped: ['quiet', 'normal'], pick_up: ['quiet', 'normal'],
  way: ['quiet', 'normal'], pick: ['hushed', 'low'], // SD3–SD5: a key turned, a bar slid, a door tried; BA2: picking is a whisper
};
/** AN2: event kinds that move the body, so worn armor makes them louder (CONFIG.ARMOR_NOISE_STEPS) */
const BODY_MOVING = new Set(['move', 'travel', 'attack', 'perk_move', 'break_free', 'pick_up']);
/** first build: checks only change beliefs (OQ-22). */
const CHECK_TYPES = new Set(['observe', 'interact', 'use_item', 'other', 'search']);

/** D-34 stub: every player action is major. */
export function isMajorAction(_event: GameEvent): boolean {
  return true;
}

type Slots = { move: number; main: number };
/** CO13: the action slots an actor gets each turn; perks or body types that add slots read here */
export const actionSlots = (_a: Actor): Slots => ({ move: CONFIG.MOVE_SLOTS, main: CONFIG.MAIN_SLOTS });
const slotsOf = (ctx: Ctx, a: Actor): Slots => {
  let s = ctx.slots.get(a.id);
  if (!s) ctx.slots.set(a.id, (s = actionSlots(a)));
  return s;
};
const hasMain = (ctx: Ctx, a: Actor): boolean => slotsOf(ctx, a).main > 0;
/** spends a main slot; false when none is left */
const useMain = (ctx: Ctx, a: Actor): boolean => { const s = slotsOf(ctx, a); if (s.main <= 0) return false; s.main--; return true; };
/** CO13: a movement spends a move slot first and a main slot when no move slot is left; null when neither is */
const useMoveSlot = (ctx: Ctx, a: Actor, mainToo: boolean): 'move' | 'main' | null => {
  const s = slotsOf(ctx, a);
  if (s.move > 0) { s.move--; return 'move'; }
  if (mainToo && s.main > 0) { s.main--; return 'main'; }
  return null;
};

type Ctx = {
  state: GameState;
  rng: Rng;
  input: TurnInput;
  events: GameEvent[];
  orders: Map<string, Order>;
  acted: Set<string>;
  /** CO13: action slots left this turn, per actor (actionSlots fills them on first use) */
  slots: Map<string, Slots>;
  surprised: Set<string>;
  defenses: Map<string, number>;
  exchangeEvents: GameEvent[];
  counters: Set<string>; // All-50 Counter: once per turn
  parryStrikes: Set<string>; // PA4: a parry's free strike back, once per turn
};

function mk(ctx: Ctx, a: Actor, kind: string, extra: Partial<GameEvent> = {}): GameEvent {
  const [noise, visibility] = SENSE[kind] ?? ['quiet', 'normal'];
  const n = ctx.state.events.length + ctx.events.length + 1;
  return { id: `t${ctx.state.turn}.${n}`, turn: ctx.state.turn, actorId: a.id, kind, zone: a.zone, ...(a.pos ? { pos: { ...a.pos } } : {}), effects: [], noise: armorNoise(ctx.state, a, kind, noise), visibility, perception: {}, ...extra };
}

/** AN1–AN4: a body-moving event is louder by the worn armor's weight steps (Quiet Mail: one step less); Soft Tread:
 * a Stealthy move is one step quieter */
function armorNoise(state: GameState, a: Actor, kind: string, noise: NoiseKey): NoiseKey {
  if (!BODY_MOVING.has(kind)) return noise;
  const worn = a.core.inventory.find((i) => i.equippedIn?.includes('armor'));
  const w = worn && itemDef(state, worn.itemId).armor?.weight;
  const steps = w ? Math.max(0, (CONFIG.ARMOR_NOISE_STEPS[w] ?? 0) - (hasPerk(a, PK.quiet_mail) ? 1 : 0)) : 0;
  const soft = kind === 'move' && a.posture === 'stealthy' && hasPerk(a, PK.soft_tread) ? 1 : 0;
  const quiet = kind === 'move' ? bestReward(a, 'quieter')?.value ?? 0 : 0; // an achievement reward
  return NOISE.at(NOISE.pos(noise) + steps - soft - quiet);
}

function withActivity(ctx: Ctx, a: Actor, ev: GameEvent, id: string | undefined): GameEvent {
  if (!id) return ev;
  try {
    const d = activity(id);
    return { ...ev, activity: id, noise: armorNoise(ctx.state, a, ev.kind, d.noise), visibility: d.visibility };
  } catch {
    return { ...ev, activity: id };
  }
}

/** C1 Never Surprised: the owner hears the attack coming, so being unaware of the attacker costs it nothing */
const hearsItComing = (state: GameState, owner: Actor, at: Located, noise: GameEvent['noise']) => hasPerk(owner, PK.never_surprised) && hears(state, owner, at, noise);

/** initiative: the ruleset's roll, but an actor unaware of anyone attacking it this turn takes INIT_UNAWARE (acts last),
 * unless it has Never Surprised and the attack's noise reaches it; ties go to the seeded rng */
function initiativeOrder(state: GameState, ids: string[], orders: Map<string, Order>, rng: Rng): string[] {
  const attackers = (id: string) => [...orders].filter(([, o]) => o.type === 'attack' && o.target === id).map(([by]) => actorById(state, by)!);
  const rows = ids.map((id) => {
    const a = actorById(state, id)!;
    const roll = ruleset.initiative(a, state, rng);
    const caught = attackers(id).some((x) => beliefStatus(state, a, x) === 'unaware' && !hearsItComing(state, a, x, armorNoise(state, x, 'attack', SENSE.attack[0])));
    return { id, init: caught || bluffed(state, a) ? CONFIG.INIT_UNAWARE : roll, tie: rng.next() }; // LI1c: a believed Bluff acts last too
  });
  rows.sort((x, y) => y.init - x.init || y.tie - x.tie);
  return rows.map((r) => r.id);
}

// ---------- after each event ----------

function emit(ctx: Ctx, ev: GameEvent, result?: CheckResult | ContestResult | AttackResult, perceived = false): void {
  const { state, rng } = ctx;
  wakeByEvent(state, ev); // NW18: a blow or a loud noise wakes sleepers first, so they hear what woke them
  if (!perceived) ev.perception = computePerception(ev, state, rng);
  noteSightings(ev, state);
  updateBeliefs(state, { kind: 'event', event: ev, result });
  if (ev.actorId === state.player.id && isMajorAction(ev)) detectPlayer(state, ev, rng);
  else if (isMajorAction(ev) && actorById(state, ev.actorId)?.posture === 'stealthy') {
    stealthDetect(state, ev, rng); // NS2
    // BG-64: whoever just spotted the stealthy actor perceives the very deed they spotted it by
    for (const [id, p] of Object.entries(computePerception(ev, state, rng))) ev.perception[id] ??= p;
  }
  if (ev.kind === 'attack' && ev.target && !ev.spar) setAttackOverrides(state, ev); // SP1: a sparring blow changes no stance
  ctx.events.push(ev);
  learnNames(state, ev, ctx.events);
  afterEvent(ctx, ev);
}

/** a perceives an attack on itself or a bandmate: override toward the attacker becomes hostile. RS6: only if a knows who
 * did it: a bandmate must see the attack fully; the target must see it fully or be aware of the attacker after it. */
function setAttackOverrides(state: GameState, ev: GameEvent): void {
  const target = actorById(state, ev.target!);
  if (!target) return;
  for (const p of state.actors) {
    if (p.id === ev.actorId || !p.mind || !isActive(p)) continue;
    const self = p.id === target.id;
    // GAP: a bandmate must perceive the attack fully (a partial event names no attacker).
    const saw = ev.perception[p.id]?.level === 'full';
    if (self ? !saw && !atLeast(p.mind.knowledge[ev.actorId]?.status, 'aware') : p.bandId !== target.bandId || !saw) continue;
    p.mind.overrides = { ...(p.mind.overrides ?? {}), [ev.actorId]: 'hostile' };
  }
}

/** mid-turn triggers and onAlert for actors that haven't acted. */
function afterEvent(ctx: Ctx, ev: GameEvent): void {
  const { state } = ctx;
  for (const a of state.actors) {
    if (ctx.acted.has(a.id) || !isActive(a) || !ctx.orders.has(a.id)) continue;
    const cur = ctx.orders.get(a.id)!;
    if (cur.source === 'trigger') continue;
    const t = fireMidTurnTrigger(state, a, ev);
    if (t) {
      ctx.orders.set(a.id, { ...t, line: t.line ?? (cur.line ? cur.line : null) });
      continue;
    }
    if ((cur.source === 'routine' || cur.source === 'fallback') && !ctx.surprised.has(a.id)) {
      const [al] = alertOrders(state, [buildActorView(state, a.id)]);
      if (al && al.actorId === a.id) ctx.orders.set(a.id, al);
    }
  }
}

/** pays a fear (engine/morale.ts) and applies a break. Rolled fears count only while the actor is engaged, as the
 * morale check did. `seen` = who perceived the event, for the bandmates a break frightens (MB23). */
function fear(ctx: Ctx, a: Actor, id: string, o: { gap?: number; mult?: number; shift?: number; overwhelm?: boolean; cost?: number } = {}, seen: Record<string, unknown> = {}): void {
  const { state } = ctx;
  if (getLibrary().fears?.[id]?.rolled && !isEngaged(state, a)) return; // the player too (MB11): isEngaged reads who is fighting them
  const r = payFear(state, ctx.rng, a, id, o);
  if (!r) return;
  // SP5: in a spar with no real foe, a surrender or a break just yields the spar
  if (sparOf(state, a.id) && !allActors(state).some((x) => x !== a && isActive(x) && (hostile(state, a, x) || hostile(state, x, a)))) { yieldSpar(state, a); return; }
  if (a === state.player) { tally(state, 'morale_breaks'); return; } // MB12: you keep control but cannot attack (doAttack)
  if (hostile(state, a, state.player)) tally(state, 'yielded');
  a.mind!.moraleState = r;
  // Q1/Q4: a surrender, or a break, replaces hostile with yielded toward everyone it was fighting
  // (broken shares the yielded stance so both tune together until further notice)
  for (const x of allActors(state)) if (x !== a && hostile(state, a, x)) a.mind!.overrides = { ...(a.mind!.overrides ?? {}), [x.id]: 'yielded' };
  if (!ctx.acted.has(a.id) && ctx.orders.has(a.id)) ctx.orders.set(a.id, brokenOrder(buildActorView(state, a.id)));
  // MB23: bandmates who perceived it are frightened too
  for (const p of allActors(state)) if (p !== a && !!a.bandId && p.bandId === a.bandId && seen[p.id]) fear(ctx, p, FR.bandmate_broken, {}, seen);
}

// ---------- actions ----------

function hold(ctx: Ctx, a: Actor, o: Order): void {
  emit(ctx, bark(mk(ctx, a, 'hold'), o));
}

/** a line said alongside an action: the event is as loud as the louder of the action and the voice, so the words carry */
function bark(ev: GameEvent, o: Order): GameEvent {
  if (!o.line) return ev;
  const voice = VOLUME_NOISE[o.line.volume];
  return { ...ev, line: { text: o.line.text, volume: o.line.volume }, bark: true, noise: NOISE.pos(voice) > NOISE.pos(ev.noise) ? voice : ev.noise };
}

/** ZP2: one leg of a move toward `goal` (a zone, or a point to stop `stopShort` short of): up to the next doorway, or
 * within the goal's zone straight at its point (position.ts walkLeg). Returns the metres walked (0: none), 'spent' when
 * the move is used up where the actor stands (held: its try to break free; a frontier), or null when it is dropped
 * (frontier for an NPC, no path). */
function doMove(ctx: Ctx, a: Actor, goal: Located, o: Order, withBark: boolean, metres: number, fresh: boolean, stopShort = 0, toward?: string, spot?: string): number | 'spent' | null {
  const { state } = ctx;
  if (goal.zone === a.zone && !goal.pos) return 0;
  // A8 Hold: a held actor's move is its try to break free; it stays in the zone either way
  const bf = a.heldBy ? breakFree(state, a, ctx.rng) : null;
  if (bf) {
    emit(ctx, mk(ctx, a, 'break_free', { target: String(bf.effect.data.by), effects: [bf.effect] }));
    return 'spent';
  }
  const link = zoneById(state, a.zone)?.links.find((l) => l.to === goal.zone);
  if (link?.frontier) {
    if (a.kind !== 'player') {
      // NW3/NW8: an NPC waits at the edge with its move spent. If the player crosses this frontier this turn it follows
      // them through, after them; otherwise its wait asks for the ground beyond to be built in the background.
      const waits = (state.scratch?.frontierWaits as FrontierWait[] | undefined) ?? [];
      state.scratch = { ...(state.scratch ?? {}), frontierWaits: [...waits.filter((w) => w.actorId !== a.id), { actorId: a.id, frontier: goal.zone }] };
      logCode(state, 'frontier_wait', { actorId: a.id, frontier: goal.zone });
      return 'spent';
    }
    // GAP: the player crossing a frontier stays in its zone; scenario setup / stage extension places it (pipeline reads scratch).
    state.scratch = { ...(state.scratch ?? {}), frontierCrossed: goal.zone };
    emit(ctx, mk(ctx, a, 'move', { target: goal.zone, effects: [{ kind: 'frontier_crossed', actorId: a.id, data: { frontier: goal.zone } }] }));
    return 'spent';
  }
  // SD7: a jump down a window or ledge: straight into the zone below, with a landing roll and flat fall damage
  if (o.jump && link?.drop && a.kind === 'player') {
    const up = zoneById(state, a.zone)!, down = zoneById(state, goal.zone)!;
    const drop = Math.max(0, heightOf(up) - heightOf(down)), was = a.pos && { ...a.pos };
    a.zone = down.id;
    a.placeId = down.placeId;
    delete a.pos;
    noteLeft(state, up.id);
    const f = landFall(state, a, drop, ctx.rng);
    emit(ctx, mk(ctx, a, 'move', { metres: 0, fromZone: up.id, ...(was ? { fromPos: was } : {}), fall: { metres: drop, damage: f.damage, landing: f.landing }, effects: f.effects }));
    return 'spent';
  }
  const from = a.zone, fromPos = a.pos && { ...a.pos };
  // SD3–SD5: a barrier not open to the walker on the next way: walk up to it, then open it (a key, the bolt's side) or try it
  const gate = gateAhead(state, a, goal.zone);
  const walked = walkLeg(state, a, goal, metres, stopShort, a, !!gate);
  if (walked === null) return null;
  if (gate && walked <= 0) return gate.pass === 'shut' && a.kind !== 'player' && gate.b.tried?.includes(a.id) ? null : atBarrier(ctx, a, gate); // an NPC tries a shut way once
  if (walked <= 0 && a.zone === from) return 0; // a doorway right where the walker stands is crossed in 0 m: still a move
  if (a === state.player && a.zone !== from) noteLeft(state, from);
  // a leg inside the zone (closing in, a step) names who it heads for and carries no fromZone; every leg keeps where it set off
  const leg = { metres: Math.round(walked * 10) / 10, ...(fromPos ? { fromPos } : {}), ...(a.zone !== from ? { fromZone: from } : toward ? { target: toward, ...(goal.zone !== a.zone ? toGo(state, a, goal.zone) : reachedSpot(a, goal, stopShort) ? { beside: true as const } : {}) } : goal.zone !== a.zone ? { heading: goal.zone, ...toGo(state, a, goal.zone) } : {}), ...(spot && a.zone === goal.zone ? { spot: reachedSpot(a, goal, stopShort) ? spot : spotOnTheWay(spot) } : {}) };
  let ev = withActivity(ctx, a, mk(ctx, a, 'move', { ...leg, ...(o.vanish ? { vanish: true as const } : {}) }), o.activity);
  if (withBark) ev = bark(ev, o);
  emit(ctx, ev);
  return walked;
}

/** BG-81: the walker stands at the spot it walked for (within its stopShort, and a step's rounding) */
function reachedSpot(a: Actor, goal: Located, stopShort: number): boolean {
  return !goal.pos || !a.pos || Math.hypot(a.pos.x - goal.pos.x, a.pos.y - goal.pos.y) <= stopShort + 0.1;
}

/** BG-47: on a leg that stops short of the way to another zone, how far that way still is (whole metres; none once there) */
function toGo(state: GameState, a: Actor, goal: string): { toGo?: number } {
  const m = wayLeftM(state, a, goal, a);
  return m !== undefined && m >= 1 ? { toGo: Math.round(m) } : {};
}

/** SD3–SD5: at the barrier: a key turns and the bar slides back on the way through (BA3, BA4), or a shut one is tried and
 * found locked, barred or blocked (the walker learns it). Either way the move is spent there. */
function atBarrier(ctx: Ctx, a: Actor, g: NonNullable<ReturnType<typeof gateAhead>>): 'spent' {
  const did = g.pass === 'opens' ? openWay(g.b, a, a.zone) : [];
  if (g.pass === 'shut') noteTried(g.b, a);
  const way = (d: WayDid) => mk(ctx, a, 'way', { target: g.to, way: { to: g.to, barrier: g.b.id, did: d } });
  if (did.length) for (const d of did) emit(ctx, way(d));
  else emit(ctx, way(`found_${shutBy(g.b, a, a.zone)}` as WayDid));
  return 'spent';
}

/** BG-111: where an order's move goes: its zone, or the spot in it (beside someone, by a way out, a side) with the walk's
 * stop-short and words. The one rule for every walk an order makes: the player's, an NPC's in turn, a spokesperson's in the
 * exchange. */
function moveGoal(state: GameState, a: Actor, o: Order): { goal: Located; opts: { stopShort?: number; toward?: string; spot?: string } } {
  const sp = o.move && o.moveSpot ? spotPoint(state, o.move, o.moveSpot, a) : null;
  if (o.moveSpot && !sp) logCode(state, 'move_spot_dropped', { actorId: a.id, to: o.move, spot: o.moveSpot });
  return {
    goal: sp ? { zone: o.move!, pos: sp.pos } : { zone: o.move! },
    opts: sp ? { stopShort: sp.stopShort, ...(sp.toward ? { toward: sp.toward } : {}), ...(sp.words ? { spot: sp.words } : {}) } : {},
  };
}

/** ZP2: walks toward `goal` on move slots: each slot walks slotMetres of it (a move slot walks; a main slot spent on it, a
 * dash, runs the rest of the turn), one leg at a time, until it gets there, the slots run out, or the move is spent or
 * dropped. `slot` pays for each new slot (null: none left); with `stopShort`, the walk ends that far from the goal's point
 * (closing in to strike). Returns false when the move was dropped. */
function walk(ctx: Ctx, a: Actor, goal: Located, o: Order, slot: (n: number) => 'move' | 'main' | null, opts: { bark?: boolean; stopShort?: number; toward?: string; spot?: string } = {}): boolean {
  const { state } = ctx;
  const there = () => (goal.pos ? distM(state, a, goal) <= (opts.stopShort ?? 0) + 0.01 : a.zone === goal.zone);
  let left = 0, fresh = false;
  for (let n = 0, legs = 0; !there() && legs < 100; legs++) {
    if (left <= 0.01) {
      const paid = slot(n++);
      if (!paid) return true;
      if (paid === 'main' && lame(state, a)) { logCode(state, 'dash_blocked', { actorId: a.id, reason: slowed(state, a) ? 'slowed' : 'crippled_leg' }); return true; }
      left = slotMetres(state, a, paid);
      fresh = true;
    }
    const r = doMove(ctx, a, goal, o, !!opts.bark && legs === 0, left, fresh, opts.stopShort ?? 0, opts.toward, opts.spot);
    if (r === null) return false;
    if (r === 'spent') return true;
    if (r === 0) { if (fresh) return true; left = 0; continue; }
    left -= r;
    noteWalked(state, a, r); // NW11: what this turn's own moves already walked
    fresh = false;
  }
  return true;
}

function dropped(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  logCode(state, 'order_dropped', { actorId: a.id, type: o.type, target: o.target });
  if (a.kind === 'npc' && o.source !== 'fallback' && isEngaged(state, a)) {
    const f = fallbackOrder(buildActorView(state, a.id), ctx.rng);
    return doMain(ctx, a, { ...f, line: f.line ?? o.line });
  }
  hold(ctx, a, o);
}

function doSpeak(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  // BG-50: a speak with no words (a code-run beat, or a call that gave no line) carries no line at all, never an empty one
  const line = o.line?.text?.trim() ? o.line : undefined;
  const ev = mk(ctx, a, 'speak', { target: o.target ?? undefined, ...(line ? { line } : {}), noise: VOLUME_NOISE[line?.volume ?? 'normal'] });
  if (a.kind === 'player') ev.speech = { skill: SPEECH_SKILL[o.type] ?? SK.persuasion, addressees: o.addressees ?? [] };
  // OQ-29: an NPC's persuade, deceive, intimidate or barter at the player rolls when the player hears it; the player answers
  const p = state.player;
  // NM3: a false name for itself is a lie, even if the agent called it talk, so it can be caught (backstop to PUSH_RULE)
  const type = o.type === 'talk' && falseName(a, line?.text) ? 'deceive' : o.type;
  const push = a.kind === 'npc' && PUSH_TYPES.includes(type) && o.target === p.id && isActive(p);
  if (push) {
    ev.perception = computePerception(ev, state, ctx.rng);
    const heard = ev.perception[p.id];
    if (hearsWords(heard)) {
      const contest = pushContest(state, a, type, ctx.rng);
      ev.contest = contest;
      ev.push = { type, listener: p.id, landed: contest.winner === 'a', ...applySpeech(a, p, type, contest),
        ...(atLeast(beliefStatus(state, a, p), 'aware') ? { seen: true as const } : {}) }; // NT10: the speaker sees how it was taken
      if (ev.push.status === 'shaken') fear(ctx, p, FR.lost_intimidation, { gap: contest.gap }); // MB15/MB28
    }
  }
  // Voice shares: only facts from its knows list
  const voice = o.source === 'agent' ? usableAgentOutputs(ctx.input).find((x) => x.actorId === a.id && x.agent === 'voice') : undefined;
  if (voice?.agent === 'voice') {
    for (const id of voice.output.shares ?? []) {
      const f = a.mind?.knows.find((k) => k.id === id);
      if (f) ev.effects.push({ kind: 'share', actorId: a.id, data: { factId: f.id, text: f.text } });
      else logCode(state, 'invalid_share', { actorId: a.id, factId: id });
    }
  }
  emit(ctx, ev, undefined, push);
  if (type === 'deceive') overhearLie(state, ev, ev.push ? [ev.push.listener] : [], ctx.rng, ev.contest?.a); // LI5a
}

/** followUp: this is One-Two's free punch (B16), which can't trigger One-Two again */
function doAttack(ctx: Ctx, a: Actor, o: Order, followUp = false): void {
  const { state, rng } = ctx;
  let t = o.target ? actorById(state, o.target) : undefined;
  // BG-25: a wasted attack says why, so the story tells that and not a miss it made up
  const wasted = (reason?: string) => emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, ...(reason ? { reason } : {}) }), o));
  // BG-25: someone down (Incapacitated) can still be struck: HP lost keeps counting while down, to Dead. Only the dead can't.
  if (!t || t === a) return wasted();
  if (healthLevel(t) === 'dead') return wasted('already_dead');
  if (t === state.player && !isActive(t)) return wasted('already_down'); // a downed player's fate is the survival roll's (D-54)
  if (a === state.player && moraleLevel(a) === 'broken') { logCode(state, 'broken_no_attack', { actorId: a.id }); return wasted('nerve_broken'); } // MB12
  if (yieldBars(state, a, t)) { logCode(state, 'yield_no_attack', { actorId: a.id, target: t.id }); return wasted('yielded_to'); } // MB43
  if (heldBack(state, a, t)) { logCode(state, 'spar_blow_held', { actorId: a.id, target: t.id }); return wasted('spar_held'); }
  const dist = sightDistM(state, a, t);
  const named = o.mode || o.item ? usableModes(state, a).find((m) => (!o.mode || m.mode.id === o.mode) && (!o.item || m.itemId === o.item)) : undefined;
  // a named skill picks the mode that uses it ("I grab him" names unarmed_grapple, not the sword in hand)
  const bySkill = !named && o.skill ? usableModes(state, a).find((x) => modeSkill(x.mode) === o.skill && x.mode.reach >= dist) : undefined;
  const m = named ?? bySkill ?? defaultMode(state, a, dist);
  // target moved first: resolves only within the mode's reach (metres, with sight); else a wasted action
  if (!m || dist > m.mode.reach) return wasted('out_of_reach');
  const fromHiding = a.posture === 'stealthy'; // All-50 Strike and Fade
  const inAndOut = fromHiding && m.mode.tree !== 'ranged' && hasPerk(a, PK.in_and_out); // A23 In and Out: only the target sees you
  const shows = fromHiding && m.mode.tree !== 'ranged' && !inAndOut;
  if (shows) a.posture = 'open'; // ST5: a melee blow shows you
  const ev = bark(mk(ctx, a, 'attack', { target: t.id, itemId: m.itemId }), o);
  ev.perception = computePerception(ev, state, rng);
  // BG-25: someone down can't defend: the blow lands as on someone unaware
  let surprised = !isActive(t) || isAsleep(t); // NW14: a sleeper is struck as unaware (Never Surprised doesn't help it)
  // NS6: a stealthy NPC can ambush the player too; the player's belief is cleared only after the blow
  if (!surprised && !atLeast(beliefStatus(state, t, a), 'suspicious')) {
    surprised = resolveAmbush(state, a.id, t.id, ev, rng).surprised && !hearsItComing(state, t, { zone: ev.zone, pos: ev.pos }, ev.noise);
    if (surprised) ctx.surprised.add(t.id);
  }
  if (shows) stealthEnd(state, a);
  if (inAndOut) updateBeliefs(state, { kind: 'detection', observerId: t.id, aboutId: a.id, status: 'aware', event: ev });
  // A11 Cover Ally: a friend in the zone steps into the path of a ranged attack and defends in the target's place
  const cover = m.mode.tree === 'ranged' ? coverFor(state, t) : undefined;
  if (cover) {
    ev.effects.push({ kind: 'covered', actorId: cover.id, data: { ally: t.id } });
    ev.target = cover.id;
    t = cover;
    surprised = false;
  }
  // SP1/SP7: a blow between sides of a live spar is a sparring blow; any other attack on or by a fighter ends its spar
  const spar = sparBetween(state, a, t);
  if (spar) ev.spar = true;
  else endSparsOf(state, [a.id, t.id]);
  const before = { level: healthLevel(t), parts: partStates(state, t), lost: t.core.condition.hpLostPct };
  const opening = openingShifts(ctx, a, t, m.mode.tree);
  const res = ruleset.attack(
    { attackerId: a.id, targetId: t.id, weaponId: m.itemId, modeId: m.mode.id, targetPart: o.targetPart ?? null, aimed: !!o.aimed,
      context: { defenderUnaware: surprised, defensesThisTurn: ctx.defenses.get(t.id) ?? 0, ...opening } },
    state, rng,
  );
  if (res.defense) ctx.defenses.set(t.id, (ctx.defenses.get(t.id) ?? 0) + 1);
  ev.effects = [...ev.effects, ...ruleset.applyEffects(res, state)];
  afterAttack(state, a, t, res, m.mode.tree === 'ranged', modeSkill(m.mode)); // perk marks (A2, A5, A10, B15)
  const hold = applyHold(a, t, res, modeSkill(m.mode)); // A8 Hold
  if (hold) ev.effects.push(hold);
  ruleset.recordUse(a, res.attack.skill, res, state);
  markEndurance(state, t, t.core.condition.hpLostPct - before.lost);
  if (spar) checkOut(state, spar); // SP4: at the limit, the fighter is out: a later blow on it is a real attack (SP7)
  ev.tier = res.attack.tier;
  ev.attack = res;
  if (m.mode.thrown && dropToGround(state, a, m.itemId, t.zone, t.pos)) { // it lands where they stand, hit or miss
    ev.effects.push({ kind: 'item_landed', actorId: a.id, data: { itemId: m.itemId, zone: t.zone } });
  }
  emit(ctx, ev, res, true);
  // Destroyed arm drops what it held: ruleset.applyEffects moves the item; each drop is its own perceived event
  for (const f of ev.effects) if (f.kind === 'item_dropped') emit(ctx, mk(ctx, t, 'item_dropped', { itemId: f.data.itemId as string }));
  // morale (MB21–MB23): a new health level a health fear covers; bandmates who perceive a fall; the one who downed it
  const after = healthLevel(t);
  const hf = HEALTH_LEVELS.pos(after) > HEALTH_LEVELS.pos(before.level) ? healthFear(t, after) : undefined;
  if (hf) fear(ctx, t, hf.id, {}, ev.perception);
  for (const { fear: f, parts } of partFears(before.parts, partStates(state, t))) fear(ctx, t, f.id, { cost: partFearCost(f, parts, actorBody(state, t).parts) }, ev.perception); // parts Crippled (or worse) by this hit
  if (!isActive(t) && before.lost < 100) { // newly down: a blow on someone already down downs no one
    fear(ctx, a, FR.foe_downed);
    for (const p of allActors(state)) if (p !== t && !!t.bandId && p.bandId === t.bandId && ev.perception[p.id]) fear(ctx, p, FR.bandmate_down, {}, ev.perception);
  }
  // B16 One-Two: an improvised hit with the other hand empty is followed by a free punch at the same foe
  if (!followUp && modeSkill(m.mode) === SK.unarmed_improvised && met(res.outcome) && hasPerk(a, PK.one_two)
    && isActive(t) && freeHand(state, a)) {
    const fist = usableModes(state, a).find((x) => modeSkill(x.mode) === SK.unarmed_strike && x.mode.reach >= 0);
    if (fist && sightDistM(state, a, t) <= fist.mode.reach) doAttack(ctx, a, { ...o, target: t.id, item: fist.itemId, mode: fist.mode.id, skill: SK.unarmed_strike, targetPart: null, aimed: false, line: null }, true);
  }
  allFiftyAfterAttack(ctx, a, t, m.mode.tree === 'ranged', m.itemId, res, fromHiding, followUp);
  parryStrike(ctx, a, t, res);
}

/** PA4: a parry at the strike gap or better gives the defender one free melee attack back at the attacker, with the
 * parrying weapon (a fist after a barehanded parry), once per turn. A free attack can earn one too: once per turn ends the chain. */
function parryStrike(ctx: Ctx, a: Actor, t: Actor, res: AttackResult): void {
  const { state } = ctx;
  if (!res.strikeBack || !isActive(t) || !isActive(a) || ctx.parryStrikes.has(t.id)) return;
  const weapon = parryItem(state, t);
  const modes = usableModes(state, t);
  const back = weapon ? modes.find((x) => x.itemId === weapon.id && x.mode.tree === 'melee' && x.mode.reach >= 0)
    : modes.find((x) => modeSkill(x.mode) === SK.unarmed_strike && x.mode.reach >= 0);
  if (!back || sightDistM(state, t, a) > back.mode.reach) return; // the blow back reaches only as far as its weapon (metres)
  ctx.parryStrikes.add(t.id);
  doAttack(ctx, t, { ...nullOrder(t.id), type: 'attack', target: a.id, item: back.itemId, mode: back.mode.id, intent: 'parry strike' }, true);
}

/** an order the engine makes for a free attack (All-50 Counter and Volley) */
const nullOrder = (actorId: string): Order => ({ actorId, type: 'hold', target: null, skill: null, intent: 'perk', source: 'trigger', line: null });

/** an engagement-limited All-50 part can be used (a use outside an engagement starts one, as perk moves do) */
function readyThisEngagement(state: GameState, a: Actor, id: string): boolean {
  if (!a.engagement) a.engagement = { start: state.turn, last: state.turn, kinds: ['fight'] };
  return usableThisEngagement(a, id);
}
function onceThisEngagement(state: GameState, a: Actor, id: string): boolean {
  if (!readyThisEngagement(state, a, id)) return false;
  useThisEngagement(a, id);
  return true;
}

/** All-50 first-attack parts. T1a Opening Strike: the owner's first melee attack on each foe in an
 * engagement gets tier shift +1. T2a Unerring: the owner's first ranged attack in an engagement, at a foe that hasn't acted
 * yet in its engagement, gives the foe's defense roll tier shift −1. Each is used up when it applies. */
function openingShifts(ctx: Ctx, a: Actor, t: Actor, tree: string): { attackerShifts?: TierShift[]; defenderShifts?: TierShift[] } {
  const { state } = ctx;
  if (tree === 'melee' && hasPerk(a, PK.opening_strike) && onceThisEngagement(state, a, `opening_strike:${t.id}`)) {
    return { attackerShifts: [{ source: 'Opening Strike', value: 1 }] };
  }
  const fresh = !t.engagement || (t.engagement.start === state.turn && !ctx.acted.has(t.id));
  if (tree === 'ranged' && fresh && hasPerk(a, PK.unerring) && onceThisEngagement(state, a, PK.unerring)) {
    return { defenderShifts: [{ source: 'Unerring', value: -1 }] };
  }
  return {};
}

/** All-50 parts that act after an attack (src/library/allPerks.ts) */
function allFiftyAfterAttack(ctx: Ctx, a: Actor, t: Actor, ranged: boolean, itemId: string | null, res: AttackResult, fromHiding: boolean, followUp: boolean): void {
  const { state, rng } = ctx;
  // T4b Second Wind: once per engagement, at Wounded or worse (not down), the health track moves one level better
  const L = CONFIG.HEALTH_TRACK;
  const i = HEALTH_LEVELS.pos(healthLevel(t));
  if (isActive(t) && hasPerk(t, PK.second_wind) && i >= HEALTH_LEVELS.pos('wounded') && !isDownLevel(L[i][0]) && onceThisEngagement(state, t, PK.second_wind)) {
    healFromPerk(state, t, L[i - 1][1] as number);
    emit(ctx, mk(ctx, t, 'perk_move', { effects: [{ kind: PK.second_wind, actorId: t.id, data: { from: L[i][0], to: L[i - 1][0] } }] }));
  }
  if (followUp) return;
  // T1c Counter: a melee attack on the owner that ends in Critical Failure or worse earns a free melee attack back, once per turn
  if (!ranged && tierLevel(res.attack) <= TIERS.pos('critical_failure') && hasPerk(t, PK.counter) && isActive(t) && isActive(a)
    && !ctx.counters.has(t.id)) {
    const back = defaultMode(state, t, sightDistM(state, t, a));
    if (back && back.mode.tree !== 'ranged') {
      ctx.counters.add(t.id);
      doAttack(ctx, t, { ...nullOrder(t.id), type: 'attack', target: a.id, item: back.itemId, mode: back.mode.id }, true);
    }
  }
  // T2b Volley: once per engagement, after a ranged hit, a free shot at a foe already fighting the owner (hostile, or sparring) that it sees
  if (ranged && met(res.outcome) && hasPerk(a, PK.volley) && isActive(a) && readyThisEngagement(state, a, PK.volley)) {
    const mode = usableModes(state, a).find((x) => x.itemId === itemId && x.mode.tree === 'ranged');
    const foes = allActors(state).filter((x) => x !== a && isActive(x) && foe(state, x, a) && atLeast(beliefStatus(state, a, x), 'aware')
      && sightDistM(state, a, x) <= (mode?.mode.reach ?? -1));
    if (mode && foes.length) {
      useThisEngagement(a, PK.volley);
      const pick = foes[rng.int(0, foes.length - 1)];
      doAttack(ctx, a, { ...nullOrder(a.id), type: 'attack', target: pick.id, item: mode.itemId, mode: mode.mode.id }, true);
    }
  }
  // T6a Strike and Fade: right after an attack from hiding, a free Vanishing roll in place
  if (fromHiding && hasPerk(a, PK.strike_and_fade) && isActive(a)) {
    if (a.posture !== 'stealthy') { a.posture = 'stealthy'; stealthStart(state, a); }
    const ev = mk(ctx, a, 'hide', { vanish: true });
    ev.effects.push({ kind: PK.strike_and_fade, actorId: a.id, data: {} });
    emit(ctx, ev);
  }
}

/** Rest [Proposed]: no active hostile actor in the zone, at most once every REST_COOLDOWN_MIN game minutes (T7). */
function doRest(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  const key = `rest:${a.id}`;
  const last = state.clocks[key];
  const threat = threatHere(state, a);
  const ev = bark(mk(ctx, a, 'rest'), o);
  if (threat || (last !== undefined && now(state) - last < CONFIG.REST_COOLDOWN_MIN)) {
    logCode(state, 'rest_blocked', { actorId: a.id, reason: threat ? 'hostile_in_zone' : 'cooldown' });
  } else {
    // H1/H6: resting in a place whose kind a healing row names (a clinic) uses that row, once paid for (PY8), else the rest row
    const row = restRow(state, a);
    applyHealing(state, a, row);
    if (row !== HL.rest) a.paid = a.paid?.filter((x) => x !== row);
    state.clocks[key] = now(state);
    ev.effects.push({ kind: 'rested', actorId: a.id, data: {} });
  }
  emit(ctx, ev);
}

/** H1/H6: resting in a place whose kind a healing row names (a clinic) uses that row when the actor paid for it (PY8), else the rest row */
function restRow(state: GameState, a: Actor): string {
  const kind = state.places.find((p) => p.id === a.placeId)?.kind ?? '';
  return Object.values(getLibrary().healing ?? {}).find((h) => h.placeKinds?.includes(kind) && a.paid?.includes(h.id))?.id ?? HL.rest;
}

/** an active hostile shares the zone with `a` (what blocks a rest) */
export const threatHere = (state: GameState, a: Actor): boolean =>
  allActors(state).some((x) => x !== a && isActive(x) && x.zone === a.zone && (foe(state, a, x) || foe(state, x, a)));

/** T6: the player waits until a time of day (o.target; none = the next one) or sleeps (the durations table's sleep row).
 * Blocked like rest when a hostile is in the zone; otherwise the clock moves on and the scenario breaks (time skip, D-30). */
function doWait(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  if (a !== state.player) return hold(ctx, a, o);
  const ev = bark(mk(ctx, a, o.type), o);
  if (threatHere(state, a) || state.mode === 'tactical') {
    logCode(state, 'wait_blocked', { actorId: a.id, reason: 'hostile_in_zone' });
  } else {
    const t = now(state);
    const named = TIME_OF_DAY.keyOf(o.target);
    // Q2: waiting until the time of day it already is does nothing, rather than skipping a day
    if (o.type === 'wait' && named && named === timeOfDay(t)) {
      logCode(state, 'wait_blocked', { actorId: a.id, reason: 'already', timeOfDay: named });
      return emit(ctx, ev);
    }
    const until = named ?? nextTimeOfDay(timeOfDay(t));
    if (o.type === 'sleep') {
      // NW12/NW15: the night: alone, the sleep row; with companions, one watch each. "Sleep" again during a night that
      // was stopped (on watch, or after someone came and went) carries it on.
      const sleepMin = getLibrary().durations?.[DU.sleep]?.minutes ?? 0;
      if (!state.night) state.night = planNight(state, sleepMin, allActors(state).filter((x) => x !== a && isActive(x) && !isAsleep(x) && x.zone === a.zone && x.bandId === a.bandId && !!x.mind?.routine && routine(x.mind.routine.id).kind === 'follow'));
      logCode(state, 'night_started', { actorId: a.id, end: state.night.end, watches: state.night.watches });
      runNight(ctx);
    } else passTime(state, minutesUntil(t, until));
    const minutes = now(state) - t;
    logCode(state, 'time_passed', { actorId: a.id, minutes, from: t, to: now(state) });
    ev.effects.push({ kind: 'time_passed', actorId: a.id, data: { minutes } }); // SC4/SC9: a time skip never ends the scenario
  }
  emit(ctx, ev);
}

/** NW18: what a sleeper does on its turn: nothing, asleep */
const asleepOrder = (a: Actor): Order => ({ actorId: a.id, type: 'idle', target: null, skill: null, intent: 'asleep', source: a.kind === 'player' ? 'player' : 'routine', activity: 'sleep' });

/** the clock moves on; natural recovery runs for that time (H12–H15) */
function passTime(state: GameState, minutes: number): void {
  advanceAging(state, minutes, (c, d) => logCode(state, c, d)); // AG16
  passiveHealing(state, minutes);
}

/** NW12/NW15/NW18: the player's night runs on. The clock steps SLEEP_STEP_MIN at a time (to the next change of watch
 * at most): everyone moves on toward their routines (catchUp), sleeps or keeps watch by the plan, and NPCs sleep by
 * their routines. It stops when someone hostile to the player arrives in the player's zone: the clock has moved on only
 * that far, they are there, and each light sleeper there may hear them (NW14). The player's sleep heals a rest per
 * REST_COOLDOWN_MIN asleep and counts as the last rest. Returns the minutes it ran. */
function runNight(ctx: Ctx): number {
  const { state, rng } = ctx;
  const p = state.player;
  const n = state.night;
  if (!n) return 0;
  const t0 = now(state);
  const noiseOf = (x: Actor) => armorNoise(state, x, 'move', SENSE.move[0]);
  let present = new Set(hostilesNear(state, p).map((x) => x.id));
  applyNightPhase(state);
  while (now(state) < n.end && !n.woke.includes(p.id) && isActive(p)) {
    const t = now(state);
    const step = Math.max(1, Math.min(CONFIG.SLEEP_STEP_MIN, nextChange(n, t) - t));
    const slept = isAsleep(p);
    passTime(state, step);
    catchUp(state, step, false);
    if (slept) {
      n.slept += step;
      for (const due = Math.floor(n.slept / CONFIG.REST_COOLDOWN_MIN); n.heals < due; n.heals++) applyHealing(state, p, restRow(state, p));
    }
    applyNightPhase(state);
    settleSleepers(state);
    const here = hostilesNear(state, p);
    const came = here.filter((x) => !present.has(x.id));
    if (came.length) {
      logCode(state, 'sleep_stopped', { actorId: p.id, by: came.map((x) => x.id) });
      (state.scratch ??= {}).nightStopped = true; // the next turn starts with them there
      for (const s of allActors(state).filter((x) => isAsleep(x) && x.zone === p.zone)) for (const x of came) if (wakeCheck(state, s, x, noiseOf(x), rng)) break;
      break;
    }
    present = new Set(here.map((x) => x.id));
  }
  if (n.slept) state.clocks[`rest:${p.id}`] = now(state);
  // the night is over at its end, or for the player once something woke them (NW18); companions sleep on to their time
  if (now(state) >= n.end) {
    for (const id of n.members) { const m = actorById(state, id); if (m?.asleep?.until !== undefined) wake(state, m, 'rested'); }
    delete state.night;
  } else if (n.woke.includes(p.id)) delete state.night;
  const minutes = now(state) - t0;
  (state.scratch ??= {}).caughtUp = ((state.scratch.caughtUp as number | undefined) ?? 0) + minutes;
  return minutes;
}

/** T1: a fight turn, else the durations row naming the order type, else the default action row (DU) */
function turnMinutes(state: GameState, o: Order): number {
  const rows = getLibrary().durations ?? {};
  if (state.mode === 'tactical') return rows[DU.fight_turn]?.minutes ?? 0;
  return (Object.values(rows).find((d) => d.orders?.includes(o.type)) ?? rows[DU.action])?.minutes ?? 0;
}

/** H2/H3: using a carried item that names a healing source applies that row and uses one up; works in a fight only
 * if the row allows it. Returns false when the item doesn't heal, so the order resolves as before. */
function doHealItem(ctx: Ctx, a: Actor, o: Order): boolean {
  const { state } = ctx;
  const inst = a.core.inventory.find((i) => i.id === o.item || i.itemId === o.item);
  const def = inst ? itemDef(state, inst.itemId) : undefined;
  const row = def?.heal ? getLibrary().healing?.[def.heal] : undefined;
  if (!inst || !row) return false;
  const ev = bark(mk(ctx, a, 'use_item', { itemId: inst.itemId }), o);
  const fight = allActors(state).some((x) => x !== a && isActive(x) && x.zone === a.zone && (foe(state, a, x) || foe(state, x, a)));
  if (fight && !row.inFight) {
    logCode(state, 'heal_blocked', { actorId: a.id, source: row.id, reason: 'hostile_in_zone' });
  } else if (!wouldHeal(state, a, row.id)) {
    logCode(state, 'heal_blocked', { actorId: a.id, source: row.id, reason: 'nothing_to_heal' });
  } else {
    applyHealing(state, a, row.id);
    inst.qty = (inst.qty ?? 1) - 1;
    if (inst.qty <= 0) a.core.inventory.splice(a.core.inventory.indexOf(inst), 1);
    ev.effects.push({ kind: 'healed', actorId: a.id, data: { source: row.id } });
  }
  emit(ctx, ev);
  return true;
}

/** SE23 (the rule lives in the ruleset) */
export { gradeMod };

function doGeneric(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const kind = o.type === 'idle' ? 'idle' : o.type;
  const ev = bark(withActivity(ctx, a, mk(ctx, a, kind, { target: o.target ?? undefined }), o.activity), o);
  let result: CheckResult | undefined;
  // BG-65: checking a door or other way out of the zone says what holds it: open, shut but theirs to open, or locked/barred/blocked
  const link = o.type === 'interact' && o.target ? zoneById(state, a.zone)?.links.find((l) => l.to === o.target) : undefined;
  if (link && !atDoor(state, a, link.to)) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: 'out_of_reach' }), o)); // BG-86
  if (link) {
    const b = barrierOn(state, link), pass = b ? passage(b, a, a.zone) : 'open';
    if (b && pass === 'shut') noteTried(b, a);
    ev.way = { to: link.to, ...(b ? { barrier: b.id } : {}), did: pass === 'open' ? 'found_open' : pass === 'opens' ? 'found_opens' : (`found_${shutBy(b!, a, a.zone)}` as WayDid) };
  }
  if (o.skill && o.type === 'observe' && a.id === state.player.id && noticeCue(o.skill)) {
    // Q17: looking is a roll against the scenario's difficulty; Success or better shows everyone in sight clearly
    const target = CONFIG.DIFFICULTY[state.hidden.stage.challenge] ?? CONFIG.DIFFICULTY.moderate;
    const modifiers = [
      ...(target !== CONFIG.DIFFICULTY.moderate ? [{ source: 'scenario difficulty', type: 'situational' as const, value: gradeMod(target) }] : []),
      ...situational(state, fnRoller(state, a, noticeCue(o.skill) === 'sound' ? FN.hearing : FN.sight), { light: zoneById(state, a.zone), actor: a }).modifiers, // ST21: light by the rolling skill's tags (Q3)
    ];
    const r = ruleset.roll({ actorId: a.id, skill: o.skill, modifiers, tierShifts: [], fn: noticeCue(o.skill) === 'sound' ? FN.hearing : FN.sight }, state, rng); // function roll
    ev.roll = r;
    ev.tier = r.tier;
    if (tierAtLeast(r.tier, 'success')) lookAround(state);
    ruleset.recordUse(a, r.skill, { actorId: a.id, skill: r.skill, target, passed: tierAtLeast(r.tier, 'success'), modifiers }, state);
  } else if (o.skill && CHECK_TYPES.has(o.type)) {
    result = ruleset.check({ actorId: a.id, skill: o.skill, target: o.target ?? undefined, modifiers: [] }, state, rng);
    ev.check = result;
    ev.effects = ruleset.applyEffects(result, state);
    ruleset.recordUse(a, result.skill, result, state);
  }
  emit(ctx, ev, result);
}

/** the barrier on the way from `a`'s zone to `to`, and that link */
const barrierTo = (state: GameState, a: Actor, to: string | null | undefined): Barrier | undefined =>
  to ? barrierOn(state, zoneById(state, a.zone)?.links.find((l) => l.to === to)) : undefined;

/** BA3/BA4: a key turned or a bar slid on purpose, in the move slot (o.way); it stands in for the turn's move. `mainToo`:
 * with the move slot gone on the walk to the door (BG-86), the free main action does it */
function doWayOp(ctx: Ctx, a: Actor, w: NonNullable<Order['way']>, mainToo = false): boolean {
  const { state } = ctx;
  const b = barrierTo(state, a, w.toZone);
  // BG-54: try it on a copy first, so an op that can't be done spends no move slot
  const dry = b && { ...b, ...(b.lock ? { lock: { ...b.lock } } : {}), ...(b.bar ? { bar: { ...b.bar } } : {}) };
  const dryWhy = !b || !dry ? 'no_barrier' : wayOp(dry, a, a.zone, w.op);
  // BG-70: opening a way shut to them is trying it: the move slot goes on it and they learn why it won't open
  if (dryWhy === 'shut' && b && useMoveSlot(ctx, a, mainToo)) {
    noteTried(b, a);
    emit(ctx, mk(ctx, a, 'way', { target: w.toZone, way: { to: w.toZone, barrier: b.id, did: `found_${shutBy(b, a, a.zone)}` as WayDid } }));
    return true;
  }
  const why = dryWhy ?? (!useMoveSlot(ctx, a, mainToo) ? 'no_move' : wayOp(b!, a, a.zone, w.op));
  if (why || !b) { logCode(state, 'way_op_dropped', { actorId: a.id, to: w.toZone, op: w.op, reason: why }); return false; }
  emit(ctx, mk(ctx, a, 'way', { target: w.toZone, way: { to: w.toZone, barrier: b.id, did: w.op } }));
  return true;
}

/** BA2: picking the lock on the way to o.target: a Lockpicking function roll (Thievery; lockpicks help) at the lock's
 * grade. Success opens it once the picking time is done: out of a fight that time passes at once; in a fight each turn at
 * it adds a fight turn of work (busy until it opens). Near Miss: not yet, keep going. Failure: beyond the picker until its
 * skill or tools get better. Critical Failure: the pick snaps (the lockpicks used are lost). Quiet: a whisper. */
function doPick(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const b = barrierTo(state, a, o.target);
  if (!b?.lock?.locked) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: b?.lock ? 'not_locked' : 'no_lock' }), o));
  if (!atDoor(state, a, o.target)) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: 'out_of_reach' }), o)); // BG-86
  const to = o.target!;
  const way = (did: WayDid, extra: Partial<GameEvent> = {}) => bark(mk(ctx, a, 'pick', { target: to, way: { to, barrier: b.id, did }, ...extra }), o);
  const skill = fnRoller(state, a, FN.lockpicking);
  const tool = pickTool(state, a, skill).itemId ?? undefined;
  const eff = effectiveSkill(state, a, skill, { itemId: tool }).value;
  if (b.beyond?.[a.id] !== undefined && eff <= b.beyond[a.id]) return emit(ctx, way('beyond'));
  const modifiers: Mod[] = CONFIG.LOCK_GRADE_MOD[b.grade] ? [{ source: 'lock', type: 'situational', value: CONFIG.LOCK_GRADE_MOD[b.grade] }] : [];
  const r = ruleset.roll({ actorId: a.id, skill, modifiers, tierShifts: [], fn: FN.lockpicking, ...(tool ? { itemId: tool } : {}) }, state, rng);
  ruleset.recordUse(a, r.skill, { actorId: a.id, skill: r.skill, target: CONFIG.DIFFICULTY[b.grade] ?? CONFIG.DIFFICULTY.moderate, passed: tierAtLeast(r.tier, 'success'), modifiers }, state);
  const extra = { roll: r, tier: r.tier };
  if (r.tier === 'critical_failure') {
    if (tool) a.core.inventory = a.core.inventory.filter((i) => i.id !== tool);
    return emit(ctx, way('pick_broke', extra));
  }
  if (r.tier === 'failure') {
    (b.beyond ??= {})[a.id] = eff;
    return emit(ctx, way('beyond', extra));
  }
  const need = pickSeconds(eff);
  if (state.mode === 'tactical') {
    const work = ((b.work ??= {})[a.id] = (b.work[a.id] ?? 0) + (getLibrary().durations?.[DU.fight_turn]?.minutes ?? 0.1) * 60);
    if (work < need || !tierAtLeast(r.tier, 'success')) return emit(ctx, way(tierAtLeast(r.tier, 'success') ? 'picking' : 'not_yet', extra));
  } else {
    const extraMin = need / 60 - turnMinutes(state, o);
    if (extraMin > 0) { passTime(state, extraMin); logCode(state, 'time_passed', { actorId: a.id, minutes: extraMin, picking: true }); }
    if (!tierAtLeast(r.tier, 'success')) return emit(ctx, way('not_yet', extra));
  }
  b.lock.locked = false;
  delete b.work?.[a.id];
  emit(ctx, way('picked', extra));
}

function doMain(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  switch (o.type) {
    case 'move':
    case 'flee':
      // a move as the main action walks one slot's worth toward the zone
      if (!o.target || o.target === a.zone) return hold(ctx, a, o);
      if (!walk(ctx, a, { zone: o.target }, o, (n) => (n === 0 ? 'move' : null), { bark: true })) return dropped(ctx, a, o);
      return;
    case 'attack':
      return doAttack(ctx, a, o);
    case 'rest':
      return doRest(ctx, a, o);
    case 'pick':
      return doPick(ctx, a, o);
    case 'hide':
      // ST3/NS2: a hide is a stealth contest per observer (stealthDetect)
      return emit(ctx, bark(mk(ctx, a, 'hide', o.vanish ? { vanish: true } : {}), o));
    case 'wait':
    case 'sleep':
      return doWait(ctx, a, o);
    case 'give': {
      const got = giveItem(state, a, o.item, o.target, o.qty);
      if (!got) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined }), o));
      return emit(ctx, bark(mk(ctx, a, 'give', { target: o.target ?? undefined, itemId: got.id, qty: got.qty }), o));
    }
    case 'buy': {
      const to = o.for ? actorById(state, o.for) : a;
      const r = buy(state, a, o.target ? actorById(state, o.target) : undefined, o.item, o.qty, to ?? a);
      if (!r.ok) {
        logCode(state, 'buy_refused', { actorId: a.id, seller: o.target, ware: o.item, reason: r.reason });
        return emit(ctx, bark(mk(ctx, a, 'buy_refused', { target: o.target ?? undefined, reason: r.reason }), o));
      }
      return emit(ctx, bark(mk(ctx, a, 'buy', {
        target: o.target ?? undefined, qty: r.qty, price: r.price,
        ...(r.itemInst ? { itemId: r.itemInst } : {}), ...(r.service ? { service: r.service } : {}), ...(r.to !== a ? { for: r.to.id } : {}),
      }), o));
    }
    case 'sell': {
      const r = sell(state, a, o.target ? actorById(state, o.target) : undefined, o.item, o.qty);
      if (!r.ok) {
        logCode(state, 'sell_refused', { actorId: a.id, buyer: o.target, item: o.item, reason: r.reason });
        return emit(ctx, bark(mk(ctx, a, 'sell_refused', { target: o.target ?? undefined, ...(o.item ? { itemId: o.item } : {}), reason: r.reason }), o));
      }
      return emit(ctx, bark(mk(ctx, a, 'sell', { target: o.target ?? undefined, qty: r.qty, price: r.price, itemId: r.itemInst }), o));
    }
    case 'equip': {
      if (!equipArmor(state, a, o.item)) return emit(ctx, bark(mk(ctx, a, 'wasted'), o));
      return emit(ctx, bark(mk(ctx, a, 'equip', { itemId: o.item ?? undefined }), o));
    }
    case 'use_item':
      if (doHealItem(ctx, a, o)) return;
      return doGeneric(ctx, a, o);
    default:
      if (isSpeech(o.type)) return doSpeak(ctx, a, o);
      return doGeneric(ctx, a, o);
  }
}

function step(ctx: Ctx, id: string): void {
  const { state } = ctx;
  const a = actorById(state, id);
  if (!a || !isActive(a)) return; // downed: order dropped
  ctx.acted.add(id);
  const o = ctx.orders.get(id)!;
  if (o.defense) a.core.standingDefense = o.defense;
  // FR2: a pick-up out of grip reach waits for the walk over to it (closeIn); the rest are free, before the action
  const later = (o.gear ?? []).filter((op) => op.op === 'pick_up' && !reachable(state, a, op));
  const g = applyGearOps(state, a, (o.gear ?? []).filter((op) => !later.includes(op)));
  for (const p of g.picked) emit(ctx, mk(ctx, a, 'pick_up', { itemId: p.itemId, target: p.from }));
  for (const id of g.summoned) emit(ctx, mk(ctx, a, 'summon', { itemId: id })); // TB6
  if (g.invalid.length) logCode(state, 'invalid_gear', { actorId: id, ops: g.invalid });
  // TV1: a move along a road with nothing else going on is a trip, walked in one turn
  const trip = tripGoal(state, a, o);
  if (trip) return doTravel(ctx, a, o, trip);
  // AE1/ZP3: a ranged attack costs the main action and a move slot (CONFIG.RANGED_MOVE_SLOTS). One that reaches from here
  // takes its move slot first, and the move goes only on what is left; one that doesn't is dropped and the move stands
  if (o.type === 'attack' && rangedHere(state, a, o)) {
    if (inReach(state, a, o)) {
      const s = slotsOf(ctx, a);
      s.move = Math.max(0, s.move - CONFIG.RANGED_MOVE_SLOTS);
      if (o.move && s.move <= 0) { logCode(state, 'move_dropped', { actorId: id, to: o.move, reason: 'ranged_attack' }); o.move = null; }
    } else if (o.move) { logCode(state, 'order_dropped', { actorId: id, type: o.type, target: o.target, reason: 'ranged_after_move' }); o.type = 'hold'; o.target = null; }
  }
  // ZP3 closing in: a melee attack on someone out of reach, with no other move planned before the blow, walks at them on
  // the move slot first and stops once in reach; still out of reach, the blow is lost (doAttack wastes it)
  // FR4: the same for every action that needs grip or weapon reach (NEEDS), and for a door worked on purpose (BG-86)
  const near = reachOf(state, a, o);
  const closeIn = !!near && !o.moveAfter && (!!o.way || !o.move || o.move === near.at.zone);
  if (closeIn && !o.way) o.move = null;
  // CO13/ZP2: a move slot walks slotMetres(…'move') toward the move's zone, and with no main action planned (hold) a main
  // slot runs slotMetres(…'main') more once the move slots run out: a dash (AE2), which a lame actor can't make
  // BG-12: a move to a spot walks to that point of the zone (beside someone, by a way out, the far side, a compass side)
  const move = (mainToo: boolean) => {
    if (!o.move) return;
    const { goal, opts } = moveGoal(state, a, o);
    if (o.move && !walk(ctx, a, goal, o, (n) => useMoveSlot(ctx, a, mainToo && n > 0), opts)) logCode(state, 'move_dropped', { actorId: id, to: o.move });
  };
  const from = { zone: a.zone, pos: a.pos && { ...a.pos } };
  const closer = () => { if (closeIn && !near!.ok()) closeInOn(ctx, a, o, near!); };
  // BA3/BA4: the key or the bar takes the move slot; BG-54: a way op that can't be done leaves the move to happen.
  // BG-86: out of reach of the door, the move slot walks to it, and the op takes the main action if that is free
  let turned = false;
  if (o.way) {
    const walked = closeIn && !near!.ok();
    closer();
    if (near!.ok()) turned = doWayOp(ctx, a, o.way, o.type === 'hold');
    else logCode(state, 'way_op_dropped', { actorId: id, to: o.way.toZone, op: o.way.op, reason: 'out_of_reach' });
    turned ||= walked;
  }
  if (!turned && !o.moveAfter) move(o.type === 'hold');
  if (!o.way) closer();
  if (later.length) {
    const g2 = applyGearOps(state, a, later);
    for (const p of g2.picked) emit(ctx, mk(ctx, a, 'pick_up', { itemId: p.itemId, target: p.from }));
    if (g2.invalid.length) logCode(state, 'invalid_gear', { actorId: id, ops: g2.invalid, reason: 'out_of_reach' });
  }
  if (o.perkMove) doPerkMove(ctx, a, o.perkMove);
  // BG-16: a move with nothing else to do is just the move: no "holds" after it (narrated as standing and waiting)
  const moved = a.zone !== from.zone || (!!a.pos && !!from.pos && distM(state, a, { zone: a.zone, pos: from.pos }) > 0.01);
  if (useMain(ctx, a) && !(o.type === 'hold' && moved && !o.line)) doMain(ctx, a, o);
  if (o.moveAfter && !turned) move(false); // AE3: act, then move
}

/** TV1–TV8: the trip: one travel event where it ends; an encounter breaks the scenario (the next one starts there, with the
 * encounter's event roll); reaching a frontier at the road's end crosses it */
function doTravel(ctx: Ctx, a: Actor, o: Order, t: NonNullable<ReturnType<typeof tripGoal>>): void {
  const { state } = ctx;
  const trip = travel(state, a, t.goal, o, ctx.rng);
  for (const id of [a.id, ...trip.companions]) noteWalked(state, { id } as Actor, Infinity); // NW11: they spent the turn on the road
  if (a.zone !== trip.fromZone) noteLeft(state, trip.fromZone);
  const detail = { metres: Math.round(trip.metres), minutes: Math.round(trip.minutes), pace: trip.pace, night: trip.night, stop: trip.stop, companions: trip.companions };
  logCode(state, 'travelled', { actorId: a.id, ...detail });
  if (trip.minutes > 0) logCode(state, 'time_passed', { actorId: a.id, minutes: trip.minutes, travel: true });
  emit(ctx, mk(ctx, a, 'travel', { metres: detail.metres, ...(a.zone !== trip.fromZone ? { fromZone: trip.fromZone } : {}), effects: [{ kind: 'travelled', actorId: a.id, data: detail }] }));
  if (trip.encounter) {
    state.stage.encounter = { eventRoll: trip.encounter.eventRoll, noticed: trip.encounter.noticed, zone: a.zone, at: trip.encounter.at };
    state.stage.breakCause = 'encounter';
  } else if (t.frontier && trip.stop === 'arrived') doMove(ctx, a, { zone: t.frontier }, o, false, 0, true);
}

/** AE5/AE8: a perk move; a free one resolves beside the main action, just before it */
function doPerkMove(ctx: Ctx, a: Actor, pm: NonNullable<Order['perkMove']>): void {
  const why = perkMoveBlock(ctx.state, a, pm.perk, pm.target);
  if (why) return logCode(ctx.state, 'perk_move_dropped', { actorId: a.id, perk: pm.perk, reason: why });
  if (pm.perk === PK.battle_cry) return doBattleCry(ctx, a);
  if (getLibrary().perks[pm.perk]?.eventArm) return emit(ctx, mk(ctx, a, 'perk_move', { effects: armThreadboundItem(ctx.state, a, pm.perk) }));
  const r = resolvePerkMove(ctx.state, a, pm.perk, pm.target!, ctx.rng);
  emit(ctx, mk(ctx, a, 'perk_move', { target: pm.target ?? undefined, effects: r.effects, ...(r.result ? { contest: r.result } : {}) }), r.result);
}

/** I9 Battle Cry: the main action; a Loud roar heard at any level, however far (battleCry in auras.ts) */
function doBattleCry(ctx: Ctx, a: Actor): void {
  const { state, rng } = ctx;
  countPerkMove(state, a, PK.battle_cry, null);
  useMain(ctx, a);
  const ev = mk(ctx, a, 'battle_cry');
  ev.perception = computePerception(ev, state, rng);
  emit(ctx, ev, undefined, true);
  for (const r of battleCry(state, a, ev, rng, (t, id, gap, overwhelm) => fear(ctx, t, id, { ...(gap === undefined ? {} : { gap }), ...(overwhelm ? { overwhelm } : {}) }))) {
    ev.effects.push({ kind: r.rallied ? 'rallied' : r.took ? 'cry_took' : 'cry_resisted', actorId: r.target.id, data: { by: a.id, perk: PK.battle_cry, ...(r.overwhelmed ? { overwhelmed: true } : {}) } });
  }
}

/** the attack mode the actor would use from where it stands, or from `from` (as doAttack picks it), and the metres to the target */
function attackMode(state: GameState, a: Actor, o: Order, from: Located = a) {
  const t = o.target ? actorById(state, o.target) : undefined;
  const dist = t ? sightDistM(state, from, t) : Infinity;
  const named = o.mode || o.item ? usableModes(state, a).find((m) => (!o.mode || m.mode.id === o.mode) && (!o.item || m.itemId === o.item)) : undefined;
  return { m: named ?? defaultMode(state, a, dist), dist };
}
const inReach = (state: GameState, a: Actor, o: Order, from: Located = a) => { const { m, dist } = attackMode(state, a, o, from); return !!m && dist <= m.mode.reach; };
/** FR4 (the NEEDS table): where this turn's action is done and whether the actor is near enough: a foe within the attack's
 * reach (melee), someone to hand to within both grip reaches, the doorway of a way worked, picked or tried within grip
 * reach; with none, the first item to pick up out of reach. null: nothing to close in on. */
function reachOf(state: GameState, a: Actor, o: Order): { at: Located; m: number; toward?: string; ok: () => boolean } | null {
  const door = (to: string | null | undefined): Located | null => {
    if (!to || !zoneById(state, a.zone)?.links.some((l) => l.to === to)) return null;
    const p = wayPoint(state, a.zone, to, a);
    return { zone: a.zone, ...(p ? { pos: p } : {}) };
  };
  const grip = (at: Located, extra = 0, toward?: string) => ({ at, m: gripReachM(state, a) + extra, ...(toward ? { toward } : {}), ok: () => withinGrip(state, a, at, extra) });
  const at = o.way && door(o.way.toZone);
  if (at) return grip(at);
  const need = NEEDS[o.type], t = o.target ? actorById(state, o.target) : undefined;
  if (need === 'weapon' && t && t !== a && isActive(t) && !rangedHere(state, a, o)) {
    const m = attackMode(state, a, o).m ?? defaultMode(state, a, 0);
    if (m) return { at: t, m: m.mode.reach, toward: t.id, ok: () => inReach(state, a, o) };
  }
  if (need === 'grip' && o.type === 'give' && t && t !== a) return grip(t, gripReachM(state, t), t.id);
  const d = need === 'grip' && !t ? door(o.target) : null;
  if (d) return grip(d);
  for (const op of o.gear ?? []) if (op.op === 'pick_up' && !reachable(state, a, op)) { const p = pickUpAt(state, op); if (p) return grip(p); }
  return null;
}

/** BG-86: the actor is within grip reach of the doorway to `to` (a zone without a rectangle has no point to measure) */
function atDoor(state: GameState, a: Actor, to: string | null | undefined): boolean {
  const p = to ? wayPoint(state, a.zone, to, a) : null;
  return !p || withinGrip(state, a, { zone: a.zone, pos: p });
}

/** FR2: a pick-up whose item is within grip reach (or gone: applyGearOps reports it) */
const reachable = (state: GameState, a: Actor, op: GearOp) => { const p = pickUpAt(state, op); return !p || withinGrip(state, a, p); };

/** ZP3/FR4 closing in: walks at the target on the move slot, stopping once within reach; across a counter, fence or rail
 * from the actor's zone it is reached over from the actor's side of it (BG-62) */
function closeInOn(ctx: Ctx, a: Actor, o: Order, near: NonNullable<ReturnType<typeof reachOf>>): void {
  const { state } = ctx;
  const over = near.at.zone !== a.zone && reachesAcross(state, a.zone, near.at.zone);
  const p = over ? wayPoint(state, a.zone, near.at.zone, a) : null;
  const goal: Located = p ? { zone: a.zone, pos: p } : near.at;
  walk(ctx, a, goal, o, (n) => (n === 0 ? useMoveSlot(ctx, a, false) : null), { stopShort: p ? 0 : Math.max(0, near.m - 0.01), ...(near.toward ? { toward: near.toward } : {}) });
}

/** AE1: the attack would be ranged from here, or (out of reach here) from where the move leads */
const rangedHere = (state: GameState, a: Actor, o: Order) => {
  const here = attackMode(state, a, o);
  const next = o.move ? shortestPath(state, a.zone, o.move)?.[0] : undefined;
  const m = here.m && here.dist <= here.m.mode.reach ? here.m : next ? attackMode(state, a, o, { zone: next }).m : here.m;
  return m?.mode.tree === 'ranged';
};
/** AE2: a Crippled or Destroyed part with the move role stops a dash, and so does Leg Bolt's slow (A6) */
const lame = (state: GameState, a: Actor) => {
  if (slowed(state, a)) return true;
  const parts = new Map(partStates(state, a).map((p) => [p.id, p.state]));
  return actorBody(state, a).parts.some((p) => p.roles.includes(RL.move) && PART_STATES.pos(parts.get(p.id) ?? 'healthy') >= PART_STATES.pos('crippled'));
};

/** ST3/ST5/NS1, NS8, NS9: posture from the turn's order, for any actor. Sneaking is a free switch; a hide is the main action; a
 * Vanish is the turn's move, contested with Vanishing (ST13); words above a whisper end the posture. An NPC's sneak or
 * vanish names the zone it goes to. A stealthy routine (the thief's prowl) keeps the actor stealthy, and a companion
 * following the player copies the player's posture (NS9). */
function setPosture(state: GameState, a: Actor, o: Order): void {
  const was = a.posture ?? 'open';
  const npc = a !== state.player;
  const goTo = npc && o.target && o.target !== a.zone && zoneById(state, o.target) ? o.target : null;
  if (o.type === 'sneak' || o.type === 'vanish') {
    a.posture = 'stealthy';
    if (o.type === 'vanish' && (npc ? goTo : o.move)) o.vanish = true;
    // A19 Melt Away: a Vanish with nowhere to go vanishes in place, as the main action, where cover or shade allows
    const zone = zoneById(state, a.zone);
    const inPlace = o.type === 'vanish' && !o.vanish && hasPerk(a, PK.melt_away) && !!zone && meltAwayHere(zone.cover, zoneLight(state, zone));
    if (inPlace) o.vanish = true;
    o.type = inPlace ? 'hide' : goTo ? 'move' : 'hold';
  }
  if (o.type === 'hide') a.posture = 'stealthy';
  const r = npc && a.mind?.routine ? routine(a.mind.routine.id) : undefined;
  if (npc && o.source === 'routine' && r?.posture === 'stealthy') a.posture = 'stealthy';
  if (npc && r?.kind === 'follow' && a.bandId === state.player.bandId) a.posture = state.player.posture ?? 'open';
  if ((o.line && o.line.volume !== 'whisper') || isSpeech(o.type)) a.posture = 'open';
  if (!npc || a.posture === was) return;
  if (a.posture === 'stealthy') stealthStart(state, a);
  else stealthEnd(state, a);
}

// ---------- the turn ----------

/** NW11: metres an actor walked on this turn's own moves (scratch.walked, reset each turn) */
function noteWalked(state: GameState, a: Actor, m: number): void {
  const w = ((state.scratch ??= {}).walked ??= {}) as Record<string, number>;
  w[a.id] = (w[a.id] ?? 0) + m;
}

/** NW11: the time a turn took moves everyone on. Each NPC not in a fight goes toward where its routine puts it at the new
 * time, as far as it could walk in that time at the travel pace (travelSpeed), less what its own move already walked:
 * one jump, no Claude calls. It stops at a shut way or an unbuilt frontier, and a road is walked by its length. Healing
 * already counts minutes. GAP: a way it holds the key to stops it too (it would need to open and shut it unseen). */
export function catchUp(state: GameState, minutes: number, deductWalked = true): void {
  if (minutes <= 0) return;
  const walked = (deductWalked ? state.scratch?.walked ?? {} : {}) as Record<string, number>;
  const agentRun = new Set((state.scratch?.agentRun as string[] | undefined) ?? []);
  for (const a of [...state.actors].sort((x, y) => x.id.localeCompare(y.id))) {
    const m = a.mind;
    // an NPC whose agent chose its move this turn keeps it: the catch-up is for routine time
    if (!m?.routine || agentRun.has(a.id) || !isActive(a) || isAsleep(a) || isEngaged(state, a) || a.heldBy || m.moraleState) continue;
    const d = desiredState(buildActorView(state, a.id));
    if (!d || d.zone === a.zone) continue;
    let left = travelSpeed(state, a, CONFIG.CATCH_UP_PACE) * minutes * 60 - (walked[a.id] ?? 0);
    for (let i = 0; i < 100 && left > 0.01 && a.zone !== d.zone; i++) {
      if (gateAhead(state, a, d.zone)) break; // a way that is not simply open
      const r = walkLeg(state, a, { zone: d.zone }, left, 0, a);
      if (!r) break;
      left -= r;
    }
  }
}

/** NW3/NW8: an NPC that walked into a frontier this turn and waits at its edge (scratch.frontierWaits, reset each turn) */
export type FrontierWait = { actorId: string; frontier: string };

export function resolveTurn(state: GameState, input: TurnInput, rng: Rng): GameEvent[] {
  if (state.scratch) { delete state.scratch.frontierWaits; delete state.scratch.walked; delete state.scratch.caughtUp; delete state.scratch.nightStopped; } // NW3/NW11: this turn's only
  (state.scratch ??= {}).agentRun = usableAgentOutputs(input).map((o) => o.actorId); // NW11: their agent moved them this turn
  const clockStart = now(state);
  wakeChecksNear(state, (x) => armorNoise(state, x, 'move', SENSE.move[0]), rng); // NW18: a light sleeper may hear someone hostile near
  noteZonesSeen(state); // where the turn starts: a frontier crossed after the last turn's end
  placeAll(state); // ZP1: anyone new on stage, or moved by a scenario, gets a spot in their zone
  delete state.stage.encounter; // TV4: an encounter's scenario has placed its people by now
  const learnedBefore = learned(state);
  const playerUp = isActive(state.player);
  // MB41: foes asked by the player's yield answer in this turn's output, before anyone acts
  for (const o of usableAgentOutputs(input)) answerYield(state, actorById(state, o.actorId)!, o.output.acceptYield);
  const active = state.actors.filter(isActive);
  const views = new Map<string, ActorView>(active.map((a) => [a.id, buildActorView(state, a.id)]));
  const fired = input.fired ?? firedOrders(state);
  const orders = mergeOrders(state, input, views, fired, rng);
  const playerOrder = isAsleep(state.player) ? asleepOrder(state.player) : fromIntent(state, input.intent, input.aimed); // NW18: asleep, your turn passes
  const imp = input.intent?.action?.improvised;
  if (imp && playerOrder.type === 'attack' && !playerOrder.item && isActive(state.player)) {
    // loot L3: the grabbed object is minted and drawn (swap stows held weapons) before the attack
    playerOrder.item = improvise(state, state.player, imp);
    playerOrder.gear = [{ op: 'swap', item: playerOrder.item }, ...(playerOrder.gear ?? [])];
  }
  if (isActive(state.player)) orders.set(state.player.id, playerOrder);
  // NW12/NW20: a sleeper does nothing (its agent is not asked); NW21: an awake band member who sees someone hostile
  // shouts to wake its sleeping bandmates
  for (const id of [...orders.keys()]) { const x = actorById(state, id); if (x && x !== state.player && isAsleep(x)) orders.set(id, asleepOrder(x)); }
  for (const c of wakeCalls(state)) orders.set(c.actorId, c);
  // the player first: a companion copies the player's new posture
  for (const id of [...orders.keys()].sort((x, y) => (x === state.player.id ? -1 : y === state.player.id ? 1 : 0))) setPosture(state, actorById(state, id)!, orders.get(id)!);
  const ctx: Ctx = {
    state, rng, input, events: [], orders, acted: new Set(), slots: new Map(), surprised: new Set(), defenses: new Map(), exchangeEvents: [], counters: new Set(), parryStrikes: new Set(),
  };
  // NT14/I4: engagement auras check each newly qualifying target before anyone acts
  for (const c of engagementAuras(state, rng, (a, id, gap, overwhelm) => fear(ctx, a, id, { gap, ...(overwhelm ? { overwhelm } : {}) }))) {
    emit(ctx, mk(ctx, c.owner, 'aura', { target: c.target.id, effects: [{ kind: c.took ? 'aura_took' : 'aura_resisted', actorId: c.target.id, data: { by: c.owner.id, perk: c.aura.perk, ...(c.overwhelmed ? { overwhelmed: true } : {}) } }] }), c.contest);
  }
  // LI5b Gut Feeling: a hunch of a hidden watcher, from its zone; the owner turns suspicious of it there
  for (const h of gutFeelings(state, rng)) {
    if (!h.felt) continue;
    const ev = mk(ctx, h.owner, 'hunch', { zone: h.watcher.zone, perception: { [h.owner.id]: { level: 'partial', cue: 'sight' } } });
    ctx.events.push(ev); // not emitted: a feeling makes no sound and shows the owner to no one
    updateBeliefs(state, { kind: 'detection', observerId: h.owner.id, aboutId: h.watcher.id, status: 'suspicious', event: ev });
  }
  const ordered = initiativeOrder(state, [...orders.keys()].sort((x, y) => (x === state.player.id ? -1 : y === state.player.id ? 1 : x < y ? -1 : 1)), orders, rng);

  // exchange slot: the player's speech, then spokespeople's spoken replies in initiative order
  const ex = input.exchange;
  if (ex && isActive(state.player) && (isSpeech(playerOrder.type) || input.quickWord)) {
    // BG-58: walk over, then speak: the player's move comes first and the words are said from where it ends, as an NPC's
    const po = playerOrder;
    if (po.move && !po.moveAfter && !po.way && !input.quickWord) {
      const { goal, opts } = moveGoal(state, state.player, po);
      if (!walk(ctx, state.player, goal, po, (n) => (n === 0 ? useMoveSlot(ctx, state.player, false) : null), opts)) logCode(state, 'move_dropped', { actorId: state.player.id, to: po.move });
      po.move = null;
    }
    // BG-83: said at the volume the player chose (whisper, normal, shout), heard as loud as that
    const volume = input.intent?.volume ?? 'normal';
    const ev = mk(ctx, state.player, 'speak', {
      // a wordless opening (talk with no line) has no line to show or remember
      ...(input.intent?.spoken?.trim() ? { line: { text: input.intent.spoken, volume } } : {}), noise: VOLUME_NOISE[volume], tier: ex.playerTier,
      speech: { skill: ex.skill, impression: ex.impression ?? undefined, addressees: input.spokespeople },
      ...(Object.values(ex.perSpokesperson).some((r) => r.tell) ? { seenThrough: Object.keys(ex.perSpokesperson).filter((sp) => ex.perSpokesperson[sp].tell) } : {}), // NM3
    });
    emit(ctx, ev);
    if (playerOrder.type === 'deceive') overhearLie(state, ev, Object.keys(ex.perSpokesperson), ctx.rng, Object.values(ex.perSpokesperson)[0]?.contest.a); // LI5a
    ctx.exchangeEvents.push(ev);
    // OQ-29: what the player's speech leaves on each listener (Shaken, Swayed; PY6 haggled prices with a seller)
    if (isSpeech(playerOrder.type)) for (const [sp, r] of Object.entries(ex.perSpokesperson)) { const s = actorById(state, sp); if (s && applySpeech(state.player, s, playerOrder.type, r.contest).status === 'shaken') fear(ctx, s, FR.lost_intimidation, { gap: r.contest.gap }); }
    if (input.quickWord) playerOrder.line = null; // A15: the line was said; the action follows in turn order
    else useMain(ctx, state.player);
    const spokes = new Set(input.spokespeople);
    for (const id of ordered) {
      const o = orders.get(id);
      const a = actorById(state, id);
      if (!spokes.has(id) || !o || !a || !isActive(a) || o.source !== 'agent') continue;
      if (!isSpeech(o.type)) {
        // A15 Quick Word: a spoken reply is free; the reply's action still comes in turn order
        if (!input.quickWord || !o.line) continue;
        doSpeak(ctx, a, { ...o, type: 'talk', target: state.player.id });
        o.line = null;
      } else {
        // the reply is the main action; the actor still takes its turn in order for gear, defense and its move (Q2)
        useMain(ctx, a);
        // move, then talk: the move comes first and the line is said from where it ends
        if (o.move && !o.moveAfter) {
          const { goal, opts } = moveGoal(state, a, o); // BG-111: stepping up to whisper ends beside the player, as everywhere
          if (!walk(ctx, a, goal, o, (n) => (n === 0 ? useMoveSlot(ctx, a, false) : null), opts)) logCode(state, 'move_dropped', { actorId: id, to: o.move });
          o.move = null;
        }
        doSpeak(ctx, a, o);
      }
      ctx.exchangeEvents.push(ctx.events[ctx.events.length - 1]);
    }
  }

  // NW12: the player's wait or sleep goes last, so everyone has acted on this turn's orders before the clock moves on
  const skipsTime = (id: string) => id === state.player.id && ['wait', 'sleep'].includes(orders.get(id)?.type ?? '');
  for (const id of ordered) if (!ctx.acted.has(id) && !skipsTime(id)) step(ctx, id);
  for (const id of ordered) if (!ctx.acted.has(id) && skipsTime(id)) step(ctx, id);

  noteFighting(state, ctx.events); // YD6: blows engage, closing in hunts, quiet turns drop both
  applyBeliefDecay(state);
  const speechSkill = playerOrder && isSpeech(playerOrder.type) ? SPEECH_SKILL[playerOrder.type] : input.quickWord && ex ? SPEECH_SKILL.talk : undefined;
  checkSecrets(state, ctx.events, ex, speechSkill);
  updateAlarms(state, ctx.events);
  headArrivals(state); // NW2: a head_to walk that got there goes back to its routine
  // QT8: talking to a giver hands in its finished job, before its agent's output (so it may offer the next one)
  handInQuests(state, (id) => input.spokespeople.includes(id) && ctx.exchangeEvents.some((e) => e.actorId === state.player.id && !!e.perception[id]));
  applyAgentEffects(state, input, {
    // GAP: "since its last call" read as the previous turn and this turn's exchange.
    heardSpeech: (id, toward) =>
      (views.get(id)?.perceived ?? []).some((e) => e.kind === 'speak' && e.actorId === toward && e.turn >= state.turn - 1) ||
      (input.spokespeople.includes(id) && toward === state.player.id && ctx.exchangeEvents.length > 0),
    heardExchange: (id) => ctx.exchangeEvents.some((e) => !!e.perception[id]),
    heardNow: (listener, speaker) => ctx.events.some((e) => e.actorId === speaker && !!e.line && hearsWords(e.perception[listener])),
  });
  // SP5: "I yield" in a spar leaves it; MB40: in a real fight it yields to the foes fighting the player. After the turn's blows
  if (input.intent?.yields && isActive(state.player)) (sparOf(state, state.player.id) ? yieldSpar(state, state.player) : playerYields(state));
  if (state.scratch?.firedOrders) state.scratch = { ...state.scratch, firedOrders: [] };
  const defeated = payDefeats(state, ctx.events);
  offersFromDefeats(state, defeated, rng); // growth proposal 2.3: a notable foe beaten may offer an essence
  expireOffers(state);
  updatePacing(state, ctx.events, learnedBefore);
  passTime(state, turnMinutes(state, playerOrder)); // T1: every turn costs its action's time (a wait adds its own)
  if (!state.scratch?.nightStopped) catchUp(state, now(state) - clockStart - ((state.scratch?.caughtUp as number | undefined) ?? 0)); // NW12: a sleep stopped by an arrival keeps them there; NW11: the turn's time moves everyone on toward their schedule (a night already moved them)
  settleSleepers(state); // NW20: NPCs fall asleep and wake by their routines
  // NW18: still asleep and nobody hostile near any more (they left, or never woke you): the rest of the night runs on
  if (state.night && isAsleep(state.player) && !state.scratch?.nightStopped && !hostilesNear(state, state.player).length) runNight(ctx);
  headArrivals(state); // NW2: a head_to walk the catch-up brought there
  updateQuests(state, ctx.events, defeated);
  noteZonesSeen(state);
  if (playerUp && !isActive(state.player)) playerDown(state, rng);
  updateChase(state); // CH6/CH7: pursuers follow through frontiers; a chase lost for CHASE_LOST_TURNS turns ends
  noteHappened(state, ctx.events, defeated); // BG-41: what the check-in judges a judged ending from
  checkScenarioEnd(state, ctx.events); // SC7/SC13: the scenario's endings, held while fighting, chased or talking; SC16 its ground
  checkRoam(state, ctx.events); // SD2 a/CH2: in free roam, what happened this turn may start a new scenario
  updateSpars(state, ctx.events); // after the scenario-break checks, so a break ends the spar this turn
  // E1: engagements (talk and fights); SP3: marked skills roll when the player's engagement ends, or when the scenario breaks
  const fight = state.player.engagement?.fight;
  const ended = updateEngagements(state, ctx.events);
  if (ended) unpaidQuests(state); // QT23
  if (ended && fight) fightEnded(state, fight, ctx.events);
  turnFeats(state, ctx.events);
  // EG7: owed rolls wait for the scenario's end (closeScenario pays them); with that off they are made every turn.
  // SM3: marks still count per engagement (or per scenario) for stacking
  if (!CONFIG.GROWTH_AT_SCENARIO_END) { improveMarked(state, rng); unlockClasses(state); }
  if (ended || state.stage.breakCause) clearMarkCounts(state.player);
  for (const x of allActors(state)) expireMarks(state, x);
  for (const x of allActors(state)) { if (x !== state.player || !growthWaits(state)) grantAllSteps(state, x); // D-226: the player's wait for the scenario's end
    syncPerkLinks(x, state.turn); syncThreadboundItemPerks(x, state.turn); } grantThreadboundItem(state.player, state); // All-50 parts and mastery achievements; linked perks; D-218 Threadbound perks
  for (const x of allActors(state)) shareSpotted(state, x); // All-50 Spotter
  releaseHolds(state, allActors(state));
  noteGains(state); // D-226: this turn's raises go on the scenario's gains summary
  if (state.stage.breakCause) closeScenario(state, rng); // SC6: record the scenario; SC4: an inner scenario's end resumes the bigger one
  state.events.push(...ctx.events);
  return ctx.events;
}

/** D-54: the player went down this turn. The fight is lethal when an active actor hostile to the player belongs to a band
 * marked lethal (the default): the story ends on the "You fell" screen. Otherwise (a band marked not lethal, a spar, or no
 * one left to finish the job) one survival roll: Near Miss or better wakes somewhere safe at Critical (the next scenario). */
function playerDown(state: GameState, rng: Rng): void {
  const p = state.player;
  if (p.engagement?.fight) p.engagement.fight.down = true; // a lost fight, even if the player wakes (the Loser scars)
  if (healthLevel(p) === 'dead') return;
  if (state.actors.some((x) => isActive(x) && hostile(state, x, p) && bandById(state, x.bandId)?.lethal !== false)) {
    logCode(state, 'player_fell', { lethal: true });
    return;
  }
  const r = survivalRoll(rng);
  logCode(state, 'survival_roll', { d100: r.d100, tier: r.tier, survived: r.survived });
  if (!r.survived) return;
  p.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'critical')![1];
  state.stage.breakCause = 'knocked_out';
}

// ---------- pacing (P7) ----------

/** how much the player knows: secrets, witnessed facts, names */
function learned(state: GameState): number {
  const j = state.player.journal;
  return j ? j.secretsKnown.length + j.factsWitnessed.length + j.namesKnown.length : 0;
}

/**
 * A quiet turn: no attack, nothing new learned, no beat fired (the beat's own reset). A stall (STALL_TURNS quiet turns
 * with no beat left) marks the scenario to end as worn out, and free roam starts (SD2 a). Rest, sleep and time skips
 * never end a scenario (SC4, SC9).
 */
function updatePacing(state: GameState, events: GameEvent[], learnedBefore: number): void {
  const quiet = !events.some((e) => e.kind === 'attack') && learned(state) === learnedBefore;
  state.stage.quiet = quiet ? (state.stage.quiet ?? 0) + 1 : 0;
  if (state.stage.breakCause || state.stage.roam) return; // SD2 a: no stall in free roam, since no scenario runs
  if (state.stage.quiet >= CONFIG.STALL_TURNS && !beatsLeft(state)) {
    state.stage.breakCause = 'story_beat';
    logCode(state, 'scenario_stalled', { number: state.stage.scenarioNumber, quiet: state.stage.quiet }); // SC12: code ended it, not the Weaver: a bug
  }
}

function beatsLeft(state: GameState): boolean {
  // a beat whose owner is down never fires, so it doesn't count
  return Object.entries(state.hidden.plans).some(([id, p]) => p.triggers.some((t) => t.when.type === 'quiet_turns' && isActive(actorById(state, t.ownerId ?? id)!)));
}

