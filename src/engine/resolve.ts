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
import type { Actor, ActorView, AttackResult, Barrier, CheckResult, ContestResult, GameEvent, GameState, Mod, Order, Rng, TierShift, WayDid } from '../types';
import { barrierOn, noteTried, openWay, passage, shutBy, wayOp, type Passage } from './barriers';
import { CONFIG } from '../config';
import { activity, actorBody, getLibrary, itemDef, routine } from '../library';
import { slotMetres } from './speed';
import { travel, tripGoal } from './travel';
import { distM, placeAll, sightDistM, spotOf, spotPoint, walkLeg, wayLeftM, type Located } from './position';
import { applyHealing, healFromPerk, passiveHealing, wouldHeal } from './heal';
import { TIERS } from '../scales';
import { defaultMode, effectiveSkill, pickSeconds, pickTool, hasPerk, meltAwayHere, healthLevel, isDownLevel, tierLevel, improveMarked, clearMarkCounts, markEndurance, modeSkill, partStates, ruleset, landFall, situational, fnRoller, survivalRoll, tierAtLeast, usableModes } from '../ruleset';
import { applyBeliefDecay, beliefStatus, computePerception, hears, hearsWords, lookAround, noteSightings, noticeCue, stealthEnd, stealthStart, updateBeliefs } from '../perception';
import { buildActorView } from '../views';
import { alertOrders, brokenOrder, detectPlayer, fallbackOrder, resolveAmbush, stealthDetect, updateAlarms } from '../minds';
import { noteFighting, updateEngagements, usableThisEngagement, useThisEngagement } from './engagement';
import { afterAttack, bluffed, coverFor, expireMarks, slowed } from './perkMarks';
import { battleCry, engagementAuras } from './auras';
import { grantAllSteps, shareSpotted } from '../ruleset/allSteps';
import { syncPerkLinks } from '../ruleset/perkLinks';
import { grantThreadboundItem, syncThreadboundItemPerks } from '../ruleset/threadboundItems';
import { applyHold, breakFree, releaseHolds } from './held';
import { armThreadboundItem, countPerkMove, freeHand, perkMoveBlock, resolvePerkMove } from './perkMoves';
import { actorById, allActors, atLeast, bandById, foe, isActive, isEngaged, hostile, shortestPath, sparBetween, wayPath, zoneById } from './relations';
import { checkOut, endSparsOf, heldBack, sparOf, updateSpars, yieldSpar } from './spar';
import { fromIntent, mergeOrders, usableAgentOutputs } from './merge';
import { fireMidTurnTrigger, firedOrders } from './triggers';
import { checkSecrets } from './secrets';
import { applyGearOps, dropToGround, equipArmor, giveItem, improvise } from './gear';
import { buy, sell } from './trade';
import { applyAgentEffects, applyIntroduces, logCode } from './effects';
import { gutFeelings } from './hunches';
import { PUSH_TYPES, SPEECH_SKILL, applySpeech, isSpeech, overhearLie, pushContest } from './speech';
import { payDefeats, tally, unlockClasses } from './xp';
import { handInQuests, unpaidQuests, updateQuests } from './quests';
import { fightEnded, turnFeats } from './feats';
import { answerYield, playerYields, yieldBars } from './yield';
import { minutesUntil, nextTimeOfDay, now, timeOfDay, zoneLight } from '../time';
import { advanceAging } from '../ruleset/age';
import { NOISE, TIME_OF_DAY, type NoiseKey } from '../scales';
import type { TurnInput } from './types';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';

// GAP: the spec sets no noise/visibility for engine-made events outside activities. Placeholders, not ruleset numbers.
const SENSE: Record<string, [GameEvent['noise'], GameEvent['visibility']]> = {
  travel: ['quiet', 'normal'], attack: ['normal', 'high'], wasted: ['normal', 'high'], move: ['quiet', 'normal'], hold: ['silent', 'low'], speak: ['normal', 'normal'], call_help: ['loud', 'normal'], battle_cry: ['loud', 'high'], alarm: ['deafening', 'high'],
  rest: ['silent', 'low'], item_dropped: ['quiet', 'normal'], pick_up: ['quiet', 'normal'],
  way: ['quiet', 'normal'], pick: ['hushed', 'low'], // SD3–SD5: a key turned, a bar slid, a door tried; BA2: picking is a whisper
};
/** AN2: event kinds that move the body, so worn armor makes them louder (CONFIG.ARMOR_NOISE_STEPS) */
const BODY_MOVING = new Set(['move', 'travel', 'attack', 'perk_move', 'break_free', 'pick_up']);
const VOLUME_NOISE = { whisper: 'hushed', normal: 'normal', shout: 'loud' } as const; // NV5: a whisper isn't heard next door
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
const hearsItComing = (state: GameState, owner: Actor, zone: string, noise: GameEvent['noise']) => hasPerk(owner, PK.never_surprised) && hears(state, owner, zone, noise);

/** initiative: the ruleset's roll, but an actor unaware of anyone attacking it this turn takes INIT_UNAWARE (acts last),
 * unless it has Never Surprised and the attack's noise reaches it; ties go to the seeded rng */
function initiativeOrder(state: GameState, ids: string[], orders: Map<string, Order>, rng: Rng): string[] {
  const attackers = (id: string) => [...orders].filter(([, o]) => o.type === 'attack' && o.target === id).map(([by]) => actorById(state, by)!);
  const rows = ids.map((id) => {
    const a = actorById(state, id)!;
    const roll = ruleset.initiative(a, state, rng);
    const caught = attackers(id).some((x) => beliefStatus(state, a, x) === 'unaware' && !hearsItComing(state, a, x.zone, armorNoise(state, x, 'attack', SENSE.attack[0])));
    return { id, init: caught || bluffed(state, a) ? CONFIG.INIT_UNAWARE : roll, tie: rng.next() }; // LI1c: a believed Bluff acts last too
  });
  rows.sort((x, y) => y.init - x.init || y.tie - x.tie);
  return rows.map((r) => r.id);
}

// ---------- after each event ----------

function emit(ctx: Ctx, ev: GameEvent, result?: CheckResult | ContestResult | AttackResult, perceived = false): void {
  const { state, rng } = ctx;
  if (!perceived) ev.perception = computePerception(ev, state, rng);
  noteSightings(ev, state);
  updateBeliefs(state, { kind: 'event', event: ev, result });
  if (ev.actorId === state.player.id && isMajorAction(ev)) detectPlayer(state, ev, rng);
  else if (isMajorAction(ev) && actorById(state, ev.actorId)?.posture === 'stealthy') stealthDetect(state, ev, rng); // NS2
  if (ev.kind === 'attack' && ev.target && !ev.spar) setAttackOverrides(state, ev); // SP1: a sparring blow changes no stance
  ctx.events.push(ev);
  if (ev.kind === 'speak' && !ev.bark && ev.line?.introduces && ev.perception[state.player.id]?.level === 'full') {
    applyIntroduces(state, actorById(state, ev.actorId)!, ev.line.introduces);
  }
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

const LEVELS = () => CONFIG.HEALTH_TRACK.map((l) => l[0]);

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
    if (a.kind !== 'player') return null; // [Proposed] NPC orders into frontiers are dropped
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
  const walked = walkLeg(state, a, goal, metres, stopShort, fresh, a, !!gate);
  if (walked === null) return null;
  if (gate && walked <= 0) return gate.pass === 'shut' && a.kind !== 'player' && gate.b.tried?.includes(a.id) ? null : atBarrier(ctx, a, gate); // an NPC tries a shut way once
  if (walked <= 0 && a.zone === from) return 0; // a doorway right where the walker stands is crossed in 0 m: still a move
  if (a === state.player && a.zone !== from) noteLeft(state, from);
  // a leg inside the zone (closing in, a step) names who it heads for and carries no fromZone
  const leg = { metres: Math.round(walked * 10) / 10, ...(a.zone !== from ? { fromZone: from, ...(fromPos ? { fromPos } : {}) } : toward ? { target: toward, ...(goal.zone !== a.zone ? toGo(state, a, goal.zone) : {}) } : goal.zone !== a.zone ? { heading: goal.zone, ...toGo(state, a, goal.zone) } : {}), ...(spot && a.zone === goal.zone ? { spot } : {}) };
  let ev = withActivity(ctx, a, mk(ctx, a, 'move', { ...leg, ...(o.vanish ? { vanish: true as const } : {}) }), o.activity);
  if (withBark) ev = bark(ev, o);
  emit(ctx, ev);
  return walked;
}

/** BG-47: on a leg that stops short of the way to another zone, how far that way still is (whole metres; none once there) */
function toGo(state: GameState, a: Actor, goal: string): { toGo?: number } {
  const m = wayLeftM(state, a, goal, a);
  return m !== undefined && m >= 1 ? { toGo: Math.round(m) } : {};
}

/** SD3–SD5: the barrier on the next way of `a`'s walk to `goal`, when it is not simply open to `a` */
function gateAhead(state: GameState, a: Actor, goal: string): { b: Barrier; to: string; pass: Passage } | null {
  if (goal === a.zone) return null;
  const next = wayPath(state, a.zone, goal, a)?.[0];
  const b = next ? barrierOn(state, zoneById(state, a.zone)?.links.find((l) => l.to === next)) : undefined;
  const pass = b ? passage(b, a, a.zone) : 'open';
  return b && next && pass !== 'open' ? { b, to: next, pass } : null;
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
  const push = a.kind === 'npc' && PUSH_TYPES.includes(o.type) && o.target === p.id && isActive(p);
  if (push) {
    ev.perception = computePerception(ev, state, ctx.rng);
    const heard = ev.perception[p.id];
    if (hearsWords(heard)) {
      const contest = pushContest(state, a, o.type, ctx.rng);
      ev.contest = contest;
      ev.push = { type: o.type, listener: p.id, landed: contest.winner === 'a', ...applySpeech(a, p, o.type, contest),
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
  if (o.type === 'deceive') overhearLie(state, ev, ev.push ? [ev.push.listener] : [], ctx.rng, ev.contest?.a); // LI5a
}

/** followUp: this is One-Two's free punch (B16), which can't trigger One-Two again */
function doAttack(ctx: Ctx, a: Actor, o: Order, followUp = false): void {
  const { state, rng } = ctx;
  let t = o.target ? actorById(state, o.target) : undefined;
  // BG-25: a wasted attack says why, so the story tells that and not a miss it made up
  const wasted = (reason?: string) => emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, ...(reason ? { reason } : {}) }), o));
  // BG-25: someone down (Incapacitated) can still be struck: HP lost keeps counting while down, to Dead. Only the dead can't.
  if (!t || t === a) return wasted();
  if (healthLevel(t) === 'Dead') return wasted('already_dead');
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
  let surprised = !isActive(t);
  // NS6: a stealthy NPC can ambush the player too; the player's belief is cleared only after the blow
  if (!surprised && !atLeast(beliefStatus(state, t, a), 'suspicious')) {
    surprised = resolveAmbush(state, a.id, t.id, ev, rng).surprised && !hearsItComing(state, t, ev.zone, ev.noise);
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
  if (m.mode.thrown && dropToGround(state, a, m.itemId, t.zone)) {
    ev.effects.push({ kind: 'item_landed', actorId: a.id, data: { itemId: m.itemId, zone: t.zone } });
  }
  emit(ctx, ev, res, true);
  // Destroyed arm drops what it held: ruleset.applyEffects moves the item; each drop is its own perceived event
  for (const f of ev.effects) if (f.kind === 'item_dropped') emit(ctx, mk(ctx, t, 'item_dropped', { itemId: f.data.itemId as string }));
  // morale (MB21–MB23): a new health level a health fear covers; bandmates who perceive a fall; the one who downed it
  const L = LEVELS();
  const after = healthLevel(t);
  const hf = L.indexOf(after) > L.indexOf(before.level) ? healthFear(t, after) : undefined;
  if (hf) fear(ctx, t, hf.id, {}, ev.perception);
  for (const { fear: f, parts } of partFears(before.parts, partStates(state, t))) fear(ctx, t, f.id, { cost: partFearCost(f, parts, actorBody(state, t).parts) }, ev.perception); // parts Crippled (or worse) by this hit
  if (!isActive(t) && before.lost < 100) { // newly down: a blow on someone already down downs no one
    fear(ctx, a, FR.foe_downed);
    for (const p of allActors(state)) if (p !== t && !!t.bandId && p.bandId === t.bandId && ev.perception[p.id]) fear(ctx, p, FR.bandmate_down, {}, ev.perception);
  }
  // B16 One-Two: an improvised hit with the other hand empty is followed by a free punch at the same foe
  if (!followUp && modeSkill(m.mode) === SK.unarmed_improvised && ONE_TWO_HITS.has(res.outcome) && hasPerk(a, PK.one_two)
    && isActive(t) && t.zone === a.zone && freeHand(state, a)) {
    const fist = usableModes(state, a).find((x) => modeSkill(x.mode) === SK.unarmed_strike && x.mode.reach >= 0);
    if (fist) doAttack(ctx, a, { ...o, target: t.id, item: fist.itemId, mode: fist.mode.id, skill: SK.unarmed_strike, targetPart: null, aimed: false, line: null }, true);
  }
  allFiftyAfterAttack(ctx, a, t, m.mode.tree === 'ranged', m.itemId, res, fromHiding, followUp);
  parryStrike(ctx, a, t, res);
}

/** PA4: a parry at the strike gap or better gives the defender one free melee attack back at the attacker, with the
 * parrying weapon (a fist after a barehanded parry), once per turn. A free attack can earn one too: once per turn ends the chain. */
function parryStrike(ctx: Ctx, a: Actor, t: Actor, res: AttackResult): void {
  const { state } = ctx;
  if (!res.strikeBack || !isActive(t) || !isActive(a) || t.zone !== a.zone || ctx.parryStrikes.has(t.id)) return;
  const weapon = parryItem(state, t);
  const modes = usableModes(state, t);
  const back = weapon ? modes.find((x) => x.itemId === weapon.id && x.mode.tree === 'melee' && x.mode.reach >= 0)
    : modes.find((x) => modeSkill(x.mode) === SK.unarmed_strike && x.mode.reach >= 0);
  if (!back) return;
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
  const i = L.findIndex(([l]) => l === healthLevel(t));
  if (isActive(t) && hasPerk(t, PK.second_wind) && i >= L.findIndex(([l]) => l === 'Wounded') && !isDownLevel(L[i][0]) && onceThisEngagement(state, t, PK.second_wind)) {
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
  if (ranged && ONE_TWO_HITS.has(res.outcome) && hasPerk(a, PK.volley) && isActive(a) && readyThisEngagement(state, a, PK.volley)) {
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
const ONE_TWO_HITS = new Set(['grazed', 'blocked', 'full_hit', 'heavy_hit', 'crushing_hit']);

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

const threatHere = (state: GameState, a: Actor): boolean =>
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
    const minutes = o.type === 'sleep' ? getLibrary().durations?.[DU.sleep]?.minutes ?? 0 : minutesUntil(t, until);
    passTime(state, minutes);
    logCode(state, 'time_passed', { actorId: a.id, minutes, from: t, to: now(state) });
    if (o.type === 'sleep') {
      // Sleep gives the rest heal once per REST_COOLDOWN_MIN of sleep, and counts as the last rest
      for (let i = 0; i < Math.floor(minutes / CONFIG.REST_COOLDOWN_MIN); i++) applyHealing(state, a, restRow(state, a));
      state.clocks[`rest:${a.id}`] = now(state);
    }
    ev.effects.push({ kind: 'time_passed', actorId: a.id, data: { minutes } }); // SC4/SC9: a time skip never ends the scenario
  }
  emit(ctx, ev);
}

/** the clock moves on; natural recovery runs for that time (H12–H15) */
function passTime(state: GameState, minutes: number): void {
  advanceAging(state, minutes, (c, d) => logCode(state, c, d)); // AG16
  passiveHealing(state, minutes);
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

/** SE23: a solo roll against a task grade moves by (moderate − grade) at the roll's skill weight, so a task graded at
 * the roller's own skill plays the same at every level (62% Success or better at 50 and at 300) */
export function gradeMod(target: number): number {
  return CONFIG.SKILL_WEIGHT * (CONFIG.DIFFICULTY.moderate - target);
}

function doGeneric(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const kind = o.type === 'idle' ? 'idle' : o.type;
  const ev = bark(withActivity(ctx, a, mk(ctx, a, kind, { target: o.target ?? undefined }), o.activity), o);
  let result: CheckResult | undefined;
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

/** BA3/BA4: a key turned or a bar slid on purpose, in the move slot (o.way); it stands in for the turn's move */
function doWayOp(ctx: Ctx, a: Actor, w: NonNullable<Order['way']>): boolean {
  const { state } = ctx;
  const b = barrierTo(state, a, w.toZone);
  // BG-54: try it on a copy first, so an op that can't be done spends no move slot
  const dry = b && { ...b, ...(b.lock ? { lock: { ...b.lock } } : {}), ...(b.bar ? { bar: { ...b.bar } } : {}) };
  const why = !b || !dry ? 'no_barrier' : wayOp(dry, a, a.zone, w.op) ?? (!useMoveSlot(ctx, a, false) ? 'no_move' : wayOp(b, a, a.zone, w.op));
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
  const g = applyGearOps(state, a, o.gear); // free, before the action
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
  const foe = o.type === 'attack' && o.target ? actorById(state, o.target) : undefined;
  const closeIn = !!foe && foe !== a && isActive(foe) && !o.moveAfter && (!o.move || o.move === foe.zone) && !rangedHere(state, a, o);
  if (closeIn) o.move = null;
  // CO13/ZP2: a move slot walks slotMetres(…'move') toward the move's zone, and with no main action planned (hold) a main
  // slot runs slotMetres(…'main') more once the move slots run out: a dash (AE2), which a lame actor can't make
  // BG-12: a move to a spot walks to that point of the zone (beside someone, by a way out, the far side, a compass side)
  const sp = o.move && o.moveSpot ? spotPoint(state, o.move, o.moveSpot, a) : null;
  if (o.moveSpot && !sp) logCode(state, 'move_spot_dropped', { actorId: id, to: o.move, spot: o.moveSpot });
  const move = (mainToo: boolean) => {
    const goal: Located = sp ? { zone: o.move!, pos: sp.pos } : { zone: o.move! };
    const opts = sp ? { stopShort: sp.stopShort, ...(sp.toward ? { toward: sp.toward } : {}), ...(sp.words ? { spot: sp.words } : {}) } : {};
    if (o.move && !walk(ctx, a, goal, o, (n) => useMoveSlot(ctx, a, mainToo && n > 0), opts)) logCode(state, 'move_dropped', { actorId: id, to: o.move });
  };
  const from = { zone: a.zone, pos: a.pos && { ...a.pos } };
  // BA3/BA4: the key or the bar takes the move slot; BG-54: a way op that can't be done leaves the move to happen
  const turned = !!o.way && doWayOp(ctx, a, o.way);
  if (!turned && !o.moveAfter) move(o.type === 'hold');
  if (closeIn && foe && !inReach(state, a, o)) {
    const m = attackMode(state, a, o).m ?? defaultMode(state, a, 0);
    if (m) walk(ctx, a, spotOf(state, foe), o, (n) => (n === 0 ? useMoveSlot(ctx, a, false) : null), { stopShort: Math.max(0, m.mode.reach - 0.01), toward: foe.id });
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
  return actorBody(state, a).parts.some((p) => p.roles.includes(RL.move) && ['Crippled', 'Destroyed'].includes(parts.get(p.id) ?? ''));
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

export function resolveTurn(state: GameState, input: TurnInput, rng: Rng): GameEvent[] {
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
  const playerOrder = fromIntent(state, input.intent, input.aimed);
  const imp = input.intent?.action?.improvised;
  if (imp && playerOrder.type === 'attack' && !playerOrder.item && isActive(state.player)) {
    // loot L3: the grabbed object is minted and drawn (swap stows held weapons) before the attack
    playerOrder.item = improvise(state, state.player, imp);
    playerOrder.gear = [{ op: 'swap', item: playerOrder.item }, ...(playerOrder.gear ?? [])];
  }
  if (isActive(state.player)) orders.set(state.player.id, playerOrder);
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
    const ev = mk(ctx, state.player, 'speak', {
      // a wordless opening (talk with no line) has no line to show or remember
      ...(input.intent?.spoken?.trim() ? { line: { text: input.intent.spoken, volume: 'normal' as const } } : {}), tier: ex.playerTier,
      speech: { skill: ex.skill, impression: ex.impression ?? undefined, addressees: input.spokespeople },
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
          if (!walk(ctx, a, { zone: o.move }, o, (n) => (n === 0 ? useMoveSlot(ctx, a, false) : null))) logCode(state, 'move_dropped', { actorId: id, to: o.move });
          o.move = null;
        }
        doSpeak(ctx, a, o);
      }
      ctx.exchangeEvents.push(ctx.events[ctx.events.length - 1]);
    }
  }

  for (const id of ordered) if (!ctx.acted.has(id)) step(ctx, id);

  noteFighting(state, ctx.events); // YD6: blows engage, closing in hunts, quiet turns drop both
  applyBeliefDecay(state);
  const speechSkill = playerOrder && isSpeech(playerOrder.type) ? SPEECH_SKILL[playerOrder.type] : input.quickWord && ex ? SPEECH_SKILL.talk : undefined;
  checkSecrets(state, ctx.events, ex, speechSkill);
  updateAlarms(state, ctx.events);
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
  updatePacing(state, ctx.events, learnedBefore);
  passTime(state, turnMinutes(state, playerOrder)); // T1: every turn costs its action's time (a wait adds its own)
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
  // SM2: with SKILL_UP_INSTANT, owed rolls are made every turn; SM3: marks still count per engagement (or per scenario)
  if (ended || state.stage.breakCause || CONFIG.SKILL_UP_INSTANT) { improveMarked(state, rng); unlockClasses(state); }
  if (ended || state.stage.breakCause) clearMarkCounts(state.player);
  for (const x of allActors(state)) expireMarks(state, x);
  for (const x of allActors(state)) { grantAllSteps(state, x); syncPerkLinks(x, state.turn); syncThreadboundItemPerks(x, state.turn); } grantThreadboundItem(state.player, state); // All-50 parts and mastery achievements; linked perks; D-218 Threadbound perks
  for (const x of allActors(state)) shareSpotted(state, x); // All-50 Spotter
  releaseHolds(state, allActors(state));
  if (state.stage.breakCause) closeScenario(state); // SC6: record the scenario; SC4: an inner scenario's end resumes the bigger one
  state.events.push(...ctx.events);
  return ctx.events;
}

/** D-54: the player went down this turn. The fight is lethal when an active actor hostile to the player belongs to a band
 * marked lethal (the default): the story ends on the "You fell" screen. Otherwise (a band marked not lethal, a spar, or no
 * one left to finish the job) one survival roll: Near Miss or better wakes somewhere safe at Critical (the next scenario). */
function playerDown(state: GameState, rng: Rng): void {
  const p = state.player;
  if (p.engagement?.fight) p.engagement.fight.down = true; // a lost fight, even if the player wakes (the Loser scars)
  if (healthLevel(p) === 'Dead') return;
  if (state.actors.some((x) => isActive(x) && hostile(state, x, p) && bandById(state, x.bandId)?.lethal !== false)) {
    logCode(state, 'player_fell', { lethal: true });
    return;
  }
  const r = survivalRoll(rng);
  logCode(state, 'survival_roll', { d100: r.d100, tier: r.tier, survived: r.survived });
  if (!r.survived) return;
  p.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'Critical')![1] as number;
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

