// The Resolution engine: one turn of pure resolution. Same state + same input + same rng = same events.
import type { Actor, ActorView, AttackResult, CheckResult, ContestResult, GameEvent, GameState, Order, Rng } from '../types';
import { CONFIG } from '../config';
import { activity, getLibrary, itemDef } from '../library';
import { applyHealing, passiveHealing } from './heal';
import { defaultMode, healthLevel, improveMarked, markEndurance, moraleCheck, partStates, ruleset, tierAtLeast, usableModes } from '../ruleset';
import { applyBeliefDecay, computePerception, lookAround, noteSightings, noticeCue, updateBeliefs } from '../perception';
import { buildActorView } from '../views';
import { alertOrders, brokenOrder, detectPlayer, fallbackOrder, resolveAmbush, updateAlarms } from '../minds';
import { updateEngagements } from './engagement';
import { afterAttack, coverFor, expireMarks } from './perkMarks';
import { actorById, allActors, atLeast, isActive, isEngaged, hostile, shortestPath, zoneById } from './relations';
import { fromIntent, mergeOrders, usableAgentOutputs } from './merge';
import { fireMidTurnTrigger, firedOrders } from './triggers';
import { checkSecrets } from './secrets';
import { applyGearOps, dropToGround, equipArmor, giveItem, improvise } from './gear';
import { applyAgentEffects, applyIntroduces, logCode } from './effects';
import { SPEECH_SKILL, isSpeech } from './speech';
import { payDefeats } from './xp';
import { advanceClock, minutesUntil, nextTimeOfDay, now, timeOfDay, zoneLight } from '../time';
import { TIME_OF_DAY } from '../scales';
import type { TurnInput } from './types';

// GAP: the spec sets no noise/visibility for engine-made events outside activities. Placeholders, not ruleset numbers.
const SENSE: Record<string, [GameEvent['noise'], GameEvent['visibility']]> = {
  attack: [2, 3], wasted: [2, 3], move: [1, 2], hold: [0, 1], speak: [2, 2], call_help: [3, 2], alarm: [3, 3],
  rest: [0, 1], item_dropped: [1, 2], pick_up: [1, 2],
};
const VOLUME_NOISE = { whisper: 1, normal: 2, shout: 3 } as const;
/** first build: checks only change beliefs (OQ-22). */
const CHECK_TYPES = new Set(['observe', 'interact', 'use_item', 'other', 'search']);

/** D-34 stub: every player action is major. */
export function isMajorAction(_event: GameEvent): boolean {
  return true;
}

type Ctx = {
  state: GameState;
  rng: Rng;
  input: TurnInput;
  events: GameEvent[];
  orders: Map<string, Order>;
  acted: Set<string>;
  mainDone: Set<string>;
  surprised: Set<string>;
  defenses: Map<string, number>;
  exchangeEvents: GameEvent[];
};

function mk(ctx: Ctx, a: Actor, kind: string, extra: Partial<GameEvent> = {}): GameEvent {
  const [noise, visibility] = SENSE[kind] ?? [1, 2];
  const n = ctx.state.events.length + ctx.events.length + 1;
  return { id: `t${ctx.state.turn}.${n}`, turn: ctx.state.turn, actorId: a.id, kind, zone: a.zone, effects: [], noise, visibility, perception: {}, ...extra };
}

function withActivity(ev: GameEvent, id: string | undefined): GameEvent {
  if (!id) return ev;
  try {
    const d = activity(id);
    return { ...ev, activity: id, noise: d.noise, visibility: d.visibility };
  } catch {
    return { ...ev, activity: id };
  }
}

function initiativeOrder(state: GameState, ids: string[], rng: Rng): string[] {
  const rows = ids.map((id) => {
    // the ruleset applies INIT_UNAWARE to unaware actors (First-build ruleset); ties go to the seeded rng
    return { id, init: ruleset.initiative(actorById(state, id)!, state, rng), tie: rng.next() };
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
  if (ev.kind === 'attack' && ev.target) setAttackOverrides(state, ev);
  ctx.events.push(ev);
  if (ev.kind === 'speak' && !ev.bark && ev.line?.introduces && ev.perception[state.player.id]?.level === 'full') {
    applyIntroduces(state, actorById(state, ev.actorId)!, ev.line.introduces);
  }
  afterEvent(ctx, ev);
}

/** a perceives an attack on itself or a bandmate: override toward the attacker becomes hostile. */
function setAttackOverrides(state: GameState, ev: GameEvent): void {
  const target = actorById(state, ev.target!);
  if (!target) return;
  for (const p of state.actors) {
    if (p.id === ev.actorId || !p.mind || !isActive(p)) continue;
    const self = p.id === target.id;
    // GAP: a bandmate must perceive the attack fully (a partial event names no attacker).
    if (!self && (p.bandId !== target.bandId || ev.perception[p.id]?.level !== 'full')) continue;
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

function morale(ctx: Ctx, a: Actor, reason: 'level' | 'bandmate_down'): void {
  const { state } = ctx;
  if (a.kind !== 'npc' || !isActive(a) || a.mind?.moraleState || !isEngaged(state, a)) return;
  const r = moraleCheck(state, a, ctx.rng, reason);
  logCode(state, 'morale_check', { actorId: a.id, reason, result: r });
  if (r === 'steady') return;
  a.mind!.moraleState = r;
  if (!ctx.acted.has(a.id) && ctx.orders.has(a.id)) ctx.orders.set(a.id, brokenOrder(buildActorView(state, a.id)));
}

const LEVELS = () => CONFIG.HEALTH_TRACK.map((l) => l[0]);

// ---------- actions ----------

function hold(ctx: Ctx, a: Actor, o: Order): void {
  emit(ctx, bark(mk(ctx, a, 'hold'), o));
}

function bark(ev: GameEvent, o: Order): GameEvent {
  return o.line ? { ...ev, line: { text: o.line.text, volume: o.line.volume }, bark: true } : ev;
}

/** one link toward `to`. Returns false when the move is dropped (frontier for an NPC, no path). */
function doMove(ctx: Ctx, a: Actor, to: string, o: Order, withBark: boolean): boolean {
  const { state } = ctx;
  if (to === a.zone) return false;
  const link = zoneById(state, a.zone)?.links.find((l) => l.to === to);
  if (link?.frontier) {
    if (a.kind !== 'player') return false; // [Proposed] NPC orders into frontiers are dropped
    // GAP: the player crossing a frontier stays in its zone; scene setup / stage extension places it (pipeline reads scratch).
    state.scratch = { ...(state.scratch ?? {}), frontierCrossed: to };
    emit(ctx, mk(ctx, a, 'move', { target: to, effects: [{ kind: 'frontier_crossed', actorId: a.id, data: { frontier: to } }] }));
    return true;
  }
  const path = shortestPath(state, a.zone, to);
  if (!path?.length) return false;
  const from = a.zone;
  const zone = zoneById(state, path[0])!;
  a.zone = zone.id;
  a.placeId = zone.placeId;
  let ev = withActivity(mk(ctx, a, 'move', { fromZone: from }), o.activity);
  if (withBark) ev = bark(ev, o);
  emit(ctx, ev);
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
  const line = o.line ?? { text: '', volume: 'normal' as const };
  const ev = mk(ctx, a, 'speak', { target: o.target ?? undefined, line, noise: VOLUME_NOISE[line.volume] });
  if (a.kind === 'player') ev.speech = { skill: SPEECH_SKILL[o.type] ?? 'persuasion', addressees: o.addressees ?? [] };
  // Voice shares: only facts from its knows list
  const voice = o.source === 'agent' ? usableAgentOutputs(ctx.input).find((x) => x.actorId === a.id && x.agent === 'voice') : undefined;
  if (voice?.agent === 'voice') {
    for (const id of voice.output.shares ?? []) {
      const f = a.mind?.knows.find((k) => k.id === id);
      if (f) ev.effects.push({ kind: 'share', actorId: a.id, data: { factId: f.id, text: f.text } });
      else logCode(state, 'invalid_share', { actorId: a.id, factId: id });
    }
  }
  emit(ctx, ev);
}

function doAttack(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  let t = o.target ? actorById(state, o.target) : undefined;
  const wasted = () => emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined }), o));
  if (!t || t === a || !isActive(t)) return wasted();
  const dist = shortestPath(state, a.zone, t.zone, true)?.length ?? Infinity;
  const named = o.mode || o.item ? usableModes(state, a).find((m) => (!o.mode || m.mode.id === o.mode) && (!o.item || m.itemId === o.item)) : undefined;
  const m = named ?? defaultMode(state, a, dist);
  // target moved first: resolves only within the mode's reach (links with sight); else a wasted action
  if (!m || dist > m.mode.reach) return wasted();
  const ev = bark(mk(ctx, a, 'attack', { target: t.id, itemId: m.itemId }), o);
  ev.perception = computePerception(ev, state, rng);
  let surprised = false;
  if (t.kind === 'npc' && !atLeast(t.mind?.knowledge[a.id]?.status, 'suspicious')) {
    surprised = resolveAmbush(state, a.id, t.id, ev, rng).surprised;
    if (surprised) ctx.surprised.add(t.id);
  }
  // A11 Cover Ally: a friend in the zone steps into the path of a ranged attack and defends in the target's place
  const cover = m.mode.tree === 'ranged' ? coverFor(state, t) : undefined;
  if (cover) {
    ev.effects.push({ kind: 'covered', actorId: cover.id, data: { ally: t.id } });
    ev.target = cover.id;
    t = cover;
    surprised = false;
  }
  const before = { level: healthLevel(t), parts: partStates(state, t), lost: t.core.condition.hpLostPct };
  const res = ruleset.attack(
    { attackerId: a.id, targetId: t.id, weaponId: m.itemId, modeId: m.mode.id, targetPart: o.targetPart ?? null, aimed: !!o.aimed,
      context: { defenderUnaware: surprised, defensesThisTurn: ctx.defenses.get(t.id) ?? 0 } },
    state, rng,
  );
  if (res.defense) ctx.defenses.set(t.id, (ctx.defenses.get(t.id) ?? 0) + 1);
  ev.effects = [...ev.effects, ...ruleset.applyEffects(res, state)];
  afterAttack(state, a, t, res, m.mode.tree === 'ranged'); // perk marks (A2, A5, A10)
  ruleset.recordUse(a, res.attack.skill, res, state);
  markEndurance(state, t, t.core.condition.hpLostPct - before.lost);
  ev.tier = res.attack.tier;
  ev.attack = res;
  if (m.mode.thrown && dropToGround(state, a, m.itemId, t.zone)) {
    ev.effects.push({ kind: 'item_landed', actorId: a.id, data: { itemId: m.itemId, zone: t.zone } });
  }
  emit(ctx, ev, res, true);
  // Destroyed arm drops what it held: ruleset.applyEffects moves the item; each drop is its own perceived event
  for (const f of ev.effects) if (f.kind === 'item_dropped') emit(ctx, mk(ctx, t, 'item_dropped', { itemId: f.data.itemId as string }));
  // morale: a new level from Injured onwards; bandmates who perceive an incapacitation
  const L = LEVELS();
  const after = healthLevel(t);
  if (L.indexOf(after) > L.indexOf(before.level) && L.indexOf(after) >= L.indexOf('Injured')) morale(ctx, t, 'level');
  if (!isActive(t)) {
    for (const p of state.actors) if (p !== t && p.bandId === t.bandId && ev.perception[p.id]) morale(ctx, p, 'bandmate_down');
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
    // H1/H6: resting in a place whose kind a healing row names (a clinic) uses that row, else the rest row
    const kind = state.places.find((p) => p.id === a.placeId)?.kind ?? '';
    const placeRow = Object.values(getLibrary().healing ?? {}).find((h) => h.placeKinds?.includes(kind));
    applyHealing(state, a, placeRow?.id ?? 'rest');
    state.clocks[key] = now(state);
    ev.effects.push({ kind: 'rested', actorId: a.id, data: {} });
  }
  emit(ctx, ev);
}

const threatHere = (state: GameState, a: Actor): boolean =>
  allActors(state).some((x) => x !== a && isActive(x) && x.zone === a.zone && (hostile(state, a, x) || hostile(state, x, a)));

/** T6: the player waits until a time of day (o.target; none = the next one) or sleeps (the durations table's sleep row).
 * Blocked like rest when a hostile is in the zone; otherwise the clock moves on and the scene breaks (time skip, D-30). */
function doWait(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  if (a !== state.player) return hold(ctx, a, o);
  const ev = bark(mk(ctx, a, o.type), o);
  if (threatHere(state, a) || state.mode === 'tactical') {
    logCode(state, 'wait_blocked', { actorId: a.id, reason: 'hostile_in_zone' });
  } else {
    const t = now(state);
    const until = TIME_OF_DAY.keyOf(o.target) ?? nextTimeOfDay(timeOfDay(t));
    const minutes = o.type === 'sleep' ? getLibrary().durations?.sleep?.minutes ?? 0 : minutesUntil(t, until);
    passTime(state, minutes);
    logCode(state, 'time_passed', { actorId: a.id, minutes, from: t, to: now(state) });
    ev.effects.push({ kind: 'time_passed', actorId: a.id, data: { minutes } });
    state.stage.breakCause = 'time_skip';
  }
  emit(ctx, ev);
}

/** the clock moves on; natural recovery runs for that time (H12–H15) */
function passTime(state: GameState, minutes: number): void {
  advanceClock(state, minutes);
  passiveHealing(state, minutes);
}

/** T1: a fight turn, else the durations row naming the order type, else the default 'action' row */
function turnMinutes(state: GameState, o: Order): number {
  const rows = getLibrary().durations ?? {};
  if (state.mode === 'tactical') return rows.fight_turn?.minutes ?? 0;
  return (Object.values(rows).find((d) => d.orders?.includes(o.type)) ?? rows.action)?.minutes ?? 0;
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
  const fight = allActors(state).some((x) => x !== a && isActive(x) && x.zone === a.zone && (hostile(state, a, x) || hostile(state, x, a)));
  if (fight && !row.inFight) {
    logCode(state, 'heal_blocked', { actorId: a.id, source: row.id, reason: 'hostile_in_zone' });
  } else {
    applyHealing(state, a, row.id);
    inst.qty = (inst.qty ?? 1) - 1;
    if (inst.qty <= 0) a.core.inventory.splice(a.core.inventory.indexOf(inst), 1);
    ev.effects.push({ kind: 'healed', actorId: a.id, data: { source: row.id } });
  }
  emit(ctx, ev);
  return true;
}

function doGeneric(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const kind = o.type === 'idle' ? 'idle' : o.type;
  const ev = bark(withActivity(mk(ctx, a, kind, { target: o.target ?? undefined }), o.activity), o);
  let result: CheckResult | undefined;
  if (o.skill && o.type === 'observe' && a.id === state.player.id && noticeCue(o.skill)) {
    // Q17 (Ali, 07/11/2026): looking is a roll against the scene's difficulty; Success or better shows everyone in sight clearly
    const target = CONFIG.DIFFICULTY[state.hidden.stage.challenge] ?? CONFIG.DIFFICULTY.moderate;
    const light = CONFIG.LIGHT_MODS[zoneLight(state, zoneById(state, a.zone))] ?? 0;
    const modifiers = [
      ...(target !== CONFIG.DIFFICULTY.moderate ? [{ source: 'scene difficulty', type: 'situational' as const, value: CONFIG.DIFFICULTY.moderate - target }] : []),
      ...(light ? [{ source: 'light', type: 'situational' as const, value: light }] : []),
    ];
    const r = ruleset.roll({ actorId: a.id, skill: o.skill, modifiers, tierShifts: [] }, state, rng);
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

function doMain(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  switch (o.type) {
    case 'move':
    case 'flee':
      if (!o.target || !doMove(ctx, a, o.target, o, true)) {
        if (o.target && o.target !== a.zone) return dropped(ctx, a, o);
        return hold(ctx, a, o);
      }
      return;
    case 'attack':
      return doAttack(ctx, a, o);
    case 'rest':
      return doRest(ctx, a, o);
    case 'wait':
    case 'sleep':
      return doWait(ctx, a, o);
    case 'give': {
      if (!giveItem(state, a, o.item, o.target)) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined }), o));
      return emit(ctx, bark(mk(ctx, a, 'give', { target: o.target ?? undefined, itemId: o.item ?? undefined }), o));
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
  if (g.invalid.length) logCode(state, 'invalid_gear', { actorId: id, ops: g.invalid });
  if (o.move && !doMove(ctx, a, o.move, o, false)) logCode(state, 'move_dropped', { actorId: id, to: o.move });
  if (!ctx.mainDone.has(id)) doMain(ctx, a, o);
}

// ---------- the turn ----------

export function resolveTurn(state: GameState, input: TurnInput, rng: Rng): GameEvent[] {
  const learnedBefore = learned(state);
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
  const ctx: Ctx = {
    state, rng, input, events: [], orders, acted: new Set(), mainDone: new Set(), surprised: new Set(), defenses: new Map(), exchangeEvents: [],
  };
  const ordered = initiativeOrder(state, [...orders.keys()].sort((x, y) => (x === state.player.id ? -1 : y === state.player.id ? 1 : x < y ? -1 : 1)), rng);

  // exchange slot: the player's speech, then spokespeople's spoken replies in initiative order
  const ex = input.exchange;
  if (ex && isActive(state.player) && isSpeech(playerOrder.type)) {
    const ev = mk(ctx, state.player, 'speak', {
      line: { text: input.intent?.spoken ?? '', volume: 'normal' }, tier: ex.playerTier,
      speech: { skill: ex.skill, impression: ex.impression ?? undefined, addressees: input.spokespeople },
    });
    emit(ctx, ev);
    ctx.exchangeEvents.push(ev);
    ctx.mainDone.add(state.player.id);
    const spokes = new Set(input.spokespeople);
    for (const id of ordered) {
      const o = orders.get(id);
      const a = actorById(state, id);
      if (!spokes.has(id) || !o || !a || !isActive(a) || o.source !== 'agent' || !isSpeech(o.type)) continue;
      ctx.acted.add(id);
      doSpeak(ctx, a, o);
      ctx.exchangeEvents.push(ctx.events[ctx.events.length - 1]);
    }
  }

  for (const id of ordered) if (!ctx.acted.has(id)) step(ctx, id);

  applyBeliefDecay(state);
  const speechSkill = playerOrder && isSpeech(playerOrder.type) ? SPEECH_SKILL[playerOrder.type] : undefined;
  checkSecrets(state, ctx.events, ex, speechSkill);
  updateAlarms(state, ctx.events);
  applyAgentEffects(state, input, {
    // GAP: "since its last call" read as the previous turn and this turn's exchange.
    heardSpeech: (id, toward) =>
      (views.get(id)?.perceived ?? []).some((e) => e.kind === 'speak' && e.actorId === toward && e.turn >= state.turn - 1) ||
      (input.spokespeople.includes(id) && toward === state.player.id && ctx.exchangeEvents.length > 0),
    heardExchange: (id) => ctx.exchangeEvents.some((e) => !!e.perception[id]),
  });
  if (state.scratch?.firedOrders) state.scratch = { ...state.scratch, firedOrders: [] };
  payDefeats(state, ctx.events);
  updatePacing(state, ctx.events, learnedBefore, playerOrder);
  passTime(state, turnMinutes(state, playerOrder)); // T1: every turn costs its action's time (a wait adds its own)
  // E1: engagements (talk and fights); SP3: marked skills roll when the player's engagement ends, or when the scene breaks
  if (updateEngagements(state, ctx.events) || state.stage.breakCause) improveMarked(state, rng);
  for (const x of allActors(state)) expireMarks(state, x);
  state.events.push(...ctx.events);
  return ctx.events;
}

// ---------- pacing (P7) ----------

/** how much the player knows: secrets, witnessed facts, names */
function learned(state: GameState): number {
  const j = state.player.journal;
  return j ? j.secretsKnown.length + j.factsWitnessed.length + j.namesKnown.length : 0;
}

/**
 * A quiet turn: no attack, nothing new learned, no beat fired (the beat's own reset). Rest outside a fight, or a
 * stall (STALL_TURNS quiet turns with no beat left), marks the scene to end; the director starts the next one.
 */
function updatePacing(state: GameState, events: GameEvent[], learnedBefore: number, playerOrder: Order): void {
  const quiet = !events.some((e) => e.kind === 'attack') && learned(state) === learnedBefore;
  state.stage.quiet = quiet ? (state.stage.quiet ?? 0) + 1 : 0;
  if (state.stage.breakCause) return;
  if (playerOrder.type === 'rest' && state.mode !== 'tactical' && isActive(state.player)) state.stage.breakCause = 'rest';
  else if (state.stage.quiet >= CONFIG.STALL_TURNS && !beatsLeft(state)) state.stage.breakCause = 'story_beat';
}

function beatsLeft(state: GameState): boolean {
  // a beat whose owner is down never fires, so it doesn't count
  return Object.entries(state.hidden.plans).some(([id, p]) => p.triggers.some((t) => t.when.type === 'quiet_turns' && isActive(actorById(state, t.ownerId ?? id)!)));
}

