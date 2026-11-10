// The Resolution engine: one turn of pure resolution. Same state + same input + same rng = same events.
import { noteLeft } from './trail';
import { DU, FR, HL, RL } from '../library/tableIds';
import { payFear } from './morale';
import { healthFear, moraleLevel } from '../ruleset/morale';
import { bestReward } from '../ruleset/achRewards';
import { parryItem } from '../ruleset/gear';
import { FN } from '../library/functionIds';
import type { Actor, ActorView, AttackResult, CheckResult, ContestResult, GameEvent, GameState, Order, Rng, TierShift } from '../types';
import { CONFIG } from '../config';
import { activity, actorBody, getLibrary, itemDef, routine } from '../library';
import { applyHealing, healFromPerk, passiveHealing, wouldHeal } from './heal';
import { TIERS } from '../scales';
import { defaultMode, hasPerk, meltAwayHere, healthLevel, isDownLevel, tierLevel, improveMarked, markEndurance, modeSkill, partStates, ruleset, situational, fnRoller, survivalRoll, tierAtLeast, usableModes } from '../ruleset';
import { applyBeliefDecay, beliefStatus, computePerception, hears, lookAround, noteSightings, noticeCue, stealthEnd, stealthStart, updateBeliefs } from '../perception';
import { buildActorView } from '../views';
import { alertOrders, brokenOrder, detectPlayer, fallbackOrder, resolveAmbush, stealthDetect, updateAlarms } from '../minds';
import { updateEngagements, usableThisEngagement, useThisEngagement } from './engagement';
import { afterAttack, bluffed, coverFor, expireMarks, slowed } from './perkMarks';
import { battleCry, engagementAuras } from './auras';
import { grantAllSteps, shareSpotted } from '../ruleset/allSteps';
import { applyHold, breakFree, releaseHolds } from './held';
import { countPerkMove, freeHand, perkMoveBlock, resolvePerkMove } from './perkMoves';
import { actorById, allActors, atLeast, bandById, foe, isActive, isEngaged, hostile, shortestPath, sparBetween, zoneById } from './relations';
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
import { advanceClock, minutesUntil, nextTimeOfDay, now, timeOfDay, zoneLight } from '../time';
import { NOISE, TIME_OF_DAY, type NoiseKey } from '../scales';
import type { TurnInput } from './types';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';

// GAP: the spec sets no noise/visibility for engine-made events outside activities. Placeholders, not ruleset numbers.
const SENSE: Record<string, [GameEvent['noise'], GameEvent['visibility']]> = {
  attack: ['normal', 'high'], wasted: ['normal', 'high'], move: ['quiet', 'normal'], hold: ['silent', 'low'], speak: ['normal', 'normal'], call_help: ['loud', 'normal'], battle_cry: ['loud', 'high'], alarm: ['deafening', 'high'],
  rest: ['silent', 'low'], item_dropped: ['quiet', 'normal'], pick_up: ['quiet', 'normal'],
};
/** AN2: event kinds that move the body, so worn armor makes them louder (CONFIG.ARMOR_NOISE_STEPS) */
const BODY_MOVING = new Set(['move', 'attack', 'perk_move', 'break_free', 'pick_up']);
const VOLUME_NOISE = { whisper: 'hushed', normal: 'normal', shout: 'loud' } as const; // NV5: a whisper isn't heard next door
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
  counters: Set<string>; // All-50 Counter: once per turn
  parryStrikes: Set<string>; // PA4: a parry's free strike back, once per turn
};

function mk(ctx: Ctx, a: Actor, kind: string, extra: Partial<GameEvent> = {}): GameEvent {
  const [noise, visibility] = SENSE[kind] ?? ['quiet', 'normal'];
  const n = ctx.state.events.length + ctx.events.length + 1;
  return { id: `t${ctx.state.turn}.${n}`, turn: ctx.state.turn, actorId: a.id, kind, zone: a.zone, effects: [], noise: armorNoise(ctx.state, a, kind, noise), visibility, perception: {}, ...extra };
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
function fear(ctx: Ctx, a: Actor, id: string, o: { gap?: number; mult?: number; shift?: number } = {}, seen: Record<string, unknown> = {}): void {
  const { state } = ctx;
  if (getLibrary().fears?.[id]?.rolled && !isEngaged(state, a)) return;
  const r = payFear(state, ctx.rng, a, id, o);
  if (!r) return;
  // SP5: in a spar with no real foe, a surrender or a break just yields the spar
  if (sparOf(state, a.id) && !allActors(state).some((x) => x !== a && isActive(x) && hostile(state, a, x))) { yieldSpar(state, a); return; }
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

function bark(ev: GameEvent, o: Order): GameEvent {
  return o.line ? { ...ev, line: { text: o.line.text, volume: o.line.volume }, bark: true } : ev;
}

/** one link toward `to`. Returns false when the move is dropped (frontier for an NPC, no path). */
function doMove(ctx: Ctx, a: Actor, to: string, o: Order, withBark: boolean): boolean {
  const { state } = ctx;
  if (to === a.zone) return false;
  // A8 Hold: a held actor's move is its try to break free; it stays in the zone either way
  const bf = a.heldBy ? breakFree(state, a, ctx.rng) : null;
  if (bf) {
    emit(ctx, mk(ctx, a, 'break_free', { target: String(bf.effect.data.by), effects: [bf.effect] }));
    return true;
  }
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
  if (a === state.player) noteLeft(state, from);
  let ev = withActivity(ctx, a, mk(ctx, a, 'move', { fromZone: from, ...(o.vanish ? { vanish: true as const } : {}) }), o.activity);
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
  if (a.kind === 'player') ev.speech = { skill: SPEECH_SKILL[o.type] ?? SK.persuasion, addressees: o.addressees ?? [] };
  // OQ-29: an NPC's persuade, deceive, intimidate or barter at the player rolls when the player hears it; the player answers
  const p = state.player;
  const push = a.kind === 'npc' && PUSH_TYPES.includes(o.type) && o.target === p.id && isActive(p);
  if (push) {
    ev.perception = computePerception(ev, state, ctx.rng);
    const heard = ev.perception[p.id];
    if (heard && (heard.level === 'full' || heard.cue === 'sound')) {
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
  const wasted = () => emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined }), o));
  if (!t || t === a || !isActive(t)) return wasted();
  if (a === state.player && moraleLevel(a) === 'broken') { logCode(state, 'broken_no_attack', { actorId: a.id }); return wasted(); } // MB12
  if (yieldBars(state, a, t)) { logCode(state, 'yield_no_attack', { actorId: a.id, target: t.id }); return wasted(); } // MB43
  if (heldBack(state, a, t)) { logCode(state, 'spar_blow_held', { actorId: a.id, target: t.id }); return wasted(); }
  const dist = shortestPath(state, a.zone, t.zone, true)?.length ?? Infinity;
  const named = o.mode || o.item ? usableModes(state, a).find((m) => (!o.mode || m.mode.id === o.mode) && (!o.item || m.itemId === o.item)) : undefined;
  // a named skill picks the mode that uses it ("I grab him" names unarmed_grapple, not the sword in hand)
  const bySkill = !named && o.skill ? usableModes(state, a).find((x) => modeSkill(x.mode) === o.skill && x.mode.reach >= dist) : undefined;
  const m = named ?? bySkill ?? defaultMode(state, a, dist);
  // target moved first: resolves only within the mode's reach (links with sight); else a wasted action
  if (!m || dist > m.mode.reach) return wasted();
  const fromHiding = a.posture === 'stealthy'; // All-50 Strike and Fade
  const inAndOut = fromHiding && m.mode.tree !== 'ranged' && hasPerk(a, PK.in_and_out); // A23 In and Out: only the target sees you
  const shows = fromHiding && m.mode.tree !== 'ranged' && !inAndOut;
  if (shows) a.posture = 'open'; // ST5: a melee blow shows you
  const ev = bark(mk(ctx, a, 'attack', { target: t.id, itemId: m.itemId }), o);
  ev.perception = computePerception(ev, state, rng);
  let surprised = false;
  // NS6: a stealthy NPC can ambush the player too; the player's belief is cleared only after the blow
  if (!atLeast(beliefStatus(state, t, a), 'suspicious')) {
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
  if (!isActive(t)) {
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
  if (!ranged && tierLevel(res.attack) <= TIERS.pos('critical_failure') && hasPerk(t, PK.counter) && isActive(t) && isActive(a) && t.zone === a.zone
    && !ctx.counters.has(t.id)) {
    const back = defaultMode(state, t, 0);
    if (back && back.mode.tree !== 'ranged') {
      ctx.counters.add(t.id);
      doAttack(ctx, t, { ...nullOrder(t.id), type: 'attack', target: a.id, item: back.itemId, mode: back.mode.id }, true);
    }
  }
  // T2b Volley: once per engagement, after a ranged hit, a free shot at a foe already fighting the owner (hostile, or sparring) that it sees
  if (ranged && ONE_TWO_HITS.has(res.outcome) && hasPerk(a, PK.volley) && isActive(a) && readyThisEngagement(state, a, PK.volley)) {
    const mode = usableModes(state, a).find((x) => x.itemId === itemId && x.mode.tree === 'ranged');
    const foes = allActors(state).filter((x) => x !== a && isActive(x) && foe(state, x, a) && atLeast(beliefStatus(state, a, x), 'aware')
      && (shortestPath(state, a.zone, x.zone, true)?.length ?? Infinity) <= (mode?.mode.reach ?? -1));
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
 * Blocked like rest when a hostile is in the zone; otherwise the clock moves on and the scene breaks (time skip, D-30). */
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

function doGeneric(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const kind = o.type === 'idle' ? 'idle' : o.type;
  const ev = bark(withActivity(ctx, a, mk(ctx, a, kind, { target: o.target ?? undefined }), o.activity), o);
  let result: CheckResult | undefined;
  if (o.skill && o.type === 'observe' && a.id === state.player.id && noticeCue(o.skill)) {
    // Q17: looking is a roll against the scene's difficulty; Success or better shows everyone in sight clearly
    const target = CONFIG.DIFFICULTY[state.hidden.stage.challenge] ?? CONFIG.DIFFICULTY.moderate;
    const modifiers = [
      ...(target !== CONFIG.DIFFICULTY.moderate ? [{ source: 'scene difficulty', type: 'situational' as const, value: CONFIG.DIFFICULTY.moderate - target }] : []),
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
  if (g.invalid.length) logCode(state, 'invalid_gear', { actorId: id, ops: g.invalid });
  // AE1: a ranged attack and a move don't share a turn: the attack stands if it reaches from here, else the move does
  if (o.move && o.type === 'attack' && rangedHere(state, a, o)) {
    if (inReach(state, a, o)) { logCode(state, 'move_dropped', { actorId: id, to: o.move, reason: 'ranged_attack' }); o.move = null; }
    else { logCode(state, 'order_dropped', { actorId: id, type: o.type, target: o.target, reason: 'ranged_after_move' }); o.type = 'hold'; o.target = null; }
  }
  const move = () => {
    if (o.move && !doMove(ctx, a, o.move, o, false)) logCode(state, 'move_dropped', { actorId: id, to: o.move });
  };
  const from = a.zone;
  if (!o.moveAfter) move();
  // AE2: dash: a player with no main action who moved and is still short of the move's zone spends the action on a second link
  if (!o.moveAfter && o.move && a === state.player && o.type === 'hold' && a.zone !== from && a.zone !== o.move && !ctx.mainDone.has(id)) {
    ctx.mainDone.add(id);
    if (lame(state, a)) logCode(state, 'dash_blocked', { actorId: id, reason: slowed(state, a) ? 'slowed' : 'crippled_leg' });
    else if (!doMove(ctx, a, o.move, o, false)) logCode(state, 'move_dropped', { actorId: id, to: o.move });
  }
  if (o.perkMove) doPerkMove(ctx, a, o.perkMove);
  if (!ctx.mainDone.has(id)) doMain(ctx, a, o);
  if (o.moveAfter) move(); // AE3: act, then move
}

/** AE5/AE8: a perk move; a free one resolves beside the main action, just before it */
function doPerkMove(ctx: Ctx, a: Actor, pm: NonNullable<Order['perkMove']>): void {
  const why = perkMoveBlock(ctx.state, a, pm.perk, pm.target);
  if (why) return logCode(ctx.state, 'perk_move_dropped', { actorId: a.id, perk: pm.perk, reason: why });
  if (pm.perk === PK.battle_cry) return doBattleCry(ctx, a);
  const r = resolvePerkMove(ctx.state, a, pm.perk, pm.target!, ctx.rng);
  emit(ctx, mk(ctx, a, 'perk_move', { target: pm.target ?? undefined, effects: r.effects, ...(r.result ? { contest: r.result } : {}) }), r.result);
}

/** I9 Battle Cry: the main action; a Loud roar heard at any level, however far (battleCry in auras.ts) */
function doBattleCry(ctx: Ctx, a: Actor): void {
  const { state, rng } = ctx;
  countPerkMove(state, a, PK.battle_cry, null);
  ctx.mainDone.add(a.id);
  const ev = mk(ctx, a, 'battle_cry');
  ev.perception = computePerception(ev, state, rng);
  emit(ctx, ev, undefined, true);
  for (const r of battleCry(state, a, ev, rng, (t, id, gap) => fear(ctx, t, id, gap === undefined ? {} : { gap }))) {
    ev.effects.push({ kind: r.rallied ? 'rallied' : r.took ? 'cry_took' : 'cry_resisted', actorId: r.target.id, data: { by: a.id, perk: PK.battle_cry } });
  }
}

/** the attack mode the actor would use from a zone (as doAttack picks it) and the distance to the target */
function attackMode(state: GameState, a: Actor, o: Order, from = a.zone) {
  const t = o.target ? actorById(state, o.target) : undefined;
  const dist = t ? shortestPath(state, from, t.zone, true)?.length ?? Infinity : Infinity;
  const named = o.mode || o.item ? usableModes(state, a).find((m) => (!o.mode || m.mode.id === o.mode) && (!o.item || m.itemId === o.item)) : undefined;
  return { m: named ?? defaultMode(state, a, dist), dist };
}
const inReach = (state: GameState, a: Actor, o: Order, from = a.zone) => { const { m, dist } = attackMode(state, a, o, from); return !!m && dist <= m.mode.reach; };
/** AE1: the attack would be ranged from here, or (out of reach here) from where the move leads */
const rangedHere = (state: GameState, a: Actor, o: Order) => {
  const here = attackMode(state, a, o);
  const there = o.move ? shortestPath(state, a.zone, o.move)?.[0] : undefined;
  const m = here.m && here.dist <= here.m.mode.reach ? here.m : there ? attackMode(state, a, o, there).m : here.m;
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
    state, rng, input, events: [], orders, acted: new Set(), mainDone: new Set(), surprised: new Set(), defenses: new Map(), exchangeEvents: [], counters: new Set(), parryStrikes: new Set(),
  };
  // NT14/I4: engagement auras check each newly qualifying target before anyone acts
  for (const c of engagementAuras(state, rng, (a, id, gap) => fear(ctx, a, id, { gap }))) {
    emit(ctx, mk(ctx, c.owner, 'aura', { target: c.target.id, effects: [{ kind: c.took ? 'aura_took' : 'aura_resisted', actorId: c.target.id, data: { by: c.owner.id, perk: c.aura.perk } }] }), c.contest);
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
      line: { text: input.intent?.spoken ?? '', volume: 'normal' }, tier: ex.playerTier,
      speech: { skill: ex.skill, impression: ex.impression ?? undefined, addressees: input.spokespeople },
    });
    emit(ctx, ev);
    if (playerOrder.type === 'deceive') overhearLie(state, ev, Object.keys(ex.perSpokesperson), ctx.rng, Object.values(ex.perSpokesperson)[0]?.contest.a); // LI5a
    ctx.exchangeEvents.push(ev);
    // OQ-29: what the player's speech leaves on each listener (Shaken, Swayed; PY6 haggled prices with a seller)
    if (isSpeech(playerOrder.type)) for (const [sp, r] of Object.entries(ex.perSpokesperson)) { const s = actorById(state, sp); if (s && applySpeech(state.player, s, playerOrder.type, r.contest).status === 'shaken') fear(ctx, s, FR.lost_intimidation, { gap: r.contest.gap }); }
    if (input.quickWord) playerOrder.line = null; // A15: the line was said; the action follows in turn order
    else ctx.mainDone.add(state.player.id);
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
        ctx.acted.add(id);
        doSpeak(ctx, a, o);
      }
      ctx.exchangeEvents.push(ctx.events[ctx.events.length - 1]);
    }
  }

  for (const id of ordered) if (!ctx.acted.has(id)) step(ctx, id);

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
    heardNow: (listener, speaker) => ctx.events.some((e) => e.actorId === speaker && !!e.line && !!e.perception[listener]),
  });
  // SP5: "I yield" in a spar leaves it; MB40: in a real fight it yields to the foes fighting the player. After the turn's blows
  if (input.intent?.yields && isActive(state.player)) (sparOf(state, state.player.id) ? yieldSpar(state, state.player) : playerYields(state));
  if (state.scratch?.firedOrders) state.scratch = { ...state.scratch, firedOrders: [] };
  const defeated = payDefeats(state, ctx.events);
  updatePacing(state, ctx.events, learnedBefore, playerOrder);
  passTime(state, turnMinutes(state, playerOrder)); // T1: every turn costs its action's time (a wait adds its own)
  updateQuests(state, ctx.events, defeated);
  if (playerUp && !isActive(state.player)) playerDown(state, rng);
  updateSpars(state, ctx.events); // after the scene-break checks, so a break ends the spar this turn
  // E1: engagements (talk and fights); SP3: marked skills roll when the player's engagement ends, or when the scene breaks
  const fight = state.player.engagement?.fight;
  const ended = updateEngagements(state, ctx.events);
  if (ended) unpaidQuests(state); // QT23
  if (ended && fight) fightEnded(state, fight, ctx.events);
  turnFeats(state, ctx.events);
  if (ended || state.stage.breakCause) { improveMarked(state, rng); unlockClasses(state); }
  for (const x of allActors(state)) expireMarks(state, x);
  for (const x of allActors(state)) grantAllSteps(state, x); // All-50 parts and mastery achievements
  for (const x of allActors(state)) shareSpotted(state, x); // All-50 Spotter
  releaseHolds(state, allActors(state));
  state.events.push(...ctx.events);
  return ctx.events;
}

/** D-54: the player went down this turn. The fight is lethal when an active actor hostile to the player belongs to a band
 * marked lethal (the default): the story ends on the "You fell" screen. Otherwise (a band marked not lethal, a spar, or no
 * one left to finish the job) one survival roll: Near Miss or better wakes somewhere safe at Critical (the next scene). */
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

