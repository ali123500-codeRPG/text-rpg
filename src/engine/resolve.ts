// The Resolution engine: one turn of pure resolution. Same state + same input + same rng = same events.
import { checkScenarioEnd, closeScenario } from './scenarioEnd';
import { checkRoam, updateChase } from './chase';
import { noticeGoals, runSteps } from './goals';
import { noteHappened } from './happened';
import { noteLeft, noteZonesSeen } from './trail';
import { heightOf } from '../scenario/heights';
import { CP, DU, FR, HL, RL, RV } from '../library/tableIds';
import { passiveFatigue, payMove, payRow, payStrain, recoverLine, restRecover, sleepMinutes, tooSpent } from './fatigue';
import { runEffort } from '../ruleset/fatigue';
import { payFear } from './morale';
import { healthFear, moraleLevel, partFearCost, partFears } from '../ruleset/morale';
import { bestReward } from '../ruleset/achRewards';
import { isHeld, parryItem, rollFnSkills } from '../ruleset/gear';
import { FN } from '../library/functionIds';
import type { Actor, ActorView, AttackResult, Barrier, CheckResult, ContestResult, Effect, DurationDef, GameEvent, GameState, GearOp, Intent, ItemInstance, Mod, Order, Rng, TierShift, WayDid } from '../types';
import { barrierOn, noteTried, openWay, passage, shutBy, wayOp, type WayOp } from './barriers';
import { actionRow, actionSeconds, reactSeconds } from '../ruleset/actionTime';
import { busyNow } from './busy';
import { CONFIG } from '../config';
import { activity, actorBody, getLibrary, itemDef, routine } from '../library';
import { moveSpeed, slotMetres } from './speed';
import { travel, travelSpeed, tripGoal } from './travel';
import { M_EPS, distM, distOrNull, gateAhead, placeAll, sightDistM, spotOnTheWay, spotPoint, walkLeg, wayLeftM, wayPoint, withinM, type Located } from './position';
import { applyHealing, calm, healFromPerk, passiveHealing, wouldHeal } from './heal';
import { FOCUS, HEALTH_LEVELS, TIERS, type BodyPoseKey } from '../scales';
import { defaultMode, effectiveSkill, gradeMod, trueSkill, pickSeconds, pickTool, hasPerk, meltAwayHere, healthLevel, isDownLevel, tierLevel, improveMarked, clearMarkCounts, markEndurance, modeSkill, partStates, roleOff, ruleset, landFall, situational, fnRoller, survivalRoll, tierAtLeast, usableModes } from '../ruleset';
import { VOLUME_NOISE } from '../perception/noise';
import { applyBeliefDecay, beliefStatus, carryingNoise, computePerception, hears, hearsWords, lookAround, noteSightings, noticeCue, perceptionOf, stealthEnd, stealthStart, updateBeliefs } from '../perception';
import { buildActorView } from '../views';
import { UNREACHABLE } from '../minds/routines';
import { alertOrders, brokenOrder, nerveHolds, desiredState, detectPlayer, fallbackOrder, headArrivals, resolveAmbush, searchFor, searchItems, searchPerson, searchSecrets, markAgainst, gripOn, openToGrip, revealItems, letSearch, staying, stealthDetect, updateAlarms } from '../minds';
import { noteFighting, updateEngagements, usableThisEngagement, useThisEngagement } from './engagement';
import { afterAttack, blindSpotNow, bluffed, coverFor, spendBluff, expireMarks, slowed } from './perkMarks';
import { battleCry, engagementAuras, sightDread } from './auras';
import { grantAllSteps, shareSpotted } from '../ruleset/allSteps';
import { syncPerkLinks } from '../ruleset/perkLinks';
import { grantThreadboundItem, syncThreadboundItemPerks } from '../ruleset/threadboundItems';
import { applyHold, breakFree, releaseHolds, restrain } from './held';
import { countPerkMove, freeGrips, freeHand, perkMoveBlock, resolvePerkMove } from './perkMoves';
import { actorById, allActors, atLeast, foe, isActive, isAsleep, isEngaged, hostile, knowsShut, reachesAcross, shortestPath, sparBetween, stance, wayPath, zoneById } from './relations';
import { checkOut, endSparsOf, heldBack, sparOf, updateSpars, yieldSpar } from './spar';
import { needOf, fromIntent, mergeOrders, usableAgentOutputs } from './merge';
import { fireMidTurnTrigger, firedOrders } from './triggers';
import { checkSecrets } from './secrets';
import { POCKET, applyGearOps, dropToGround, equipArmor, fadeSoulbound, giveItem, gripReachM, improvise, pickUpAt, withinGrip } from './gear';
import { contentsOf, findContainer, guarded, inContainer, openContainer, ownerOf, theft, wornPack } from './containers';
import { cantSteady, steady } from './steady';
import { breakInside } from './breakage';
import { inPack } from './pockets';
import { filchAftermath, filchContest, filchSize, filchable, takeFilched, type Filched } from './filch';
import { buy, sell } from './trade';
import { applyAgentEffects, learnNames, logCode, loseNerve } from './effects';
import { falseName, r1 } from '../words';
import { gutFeelings } from './hunches';
import { PUSH_TYPES, SPEECH_SKILL, applySpeech, isSpeech, overhearLie, pushContest, speechSkill as speechSkillOf } from './speech';
import { growthWaits, payDefeats, tally, unlockClasses } from './xp';
import { noteGains } from './growth';
import { expireOffers, offersFromDefeats } from './essence';
import { handInQuests, unpaidQuests, updateQuests } from './quests';
import { fightEnded, gaveUpFeats, turnFeats } from './feats';
import { answerMercy, answerYield, askMercy, finishers, perceivesNow, playerYields, settleMercy, yieldBars } from './yield';
import { answerOffer, answerOffers, canOffer, makeOffer, OFFER_TYPES, playerOffer, truceBars, type StoodDown, type TalkedYield } from './offer';
import { minutesUntil, nextTimeOfDay, noteTurnEnd, now, timeOfDay, zoneLight } from '../time';
import { advanceAging } from '../ruleset/age';
import { NOISE, TIME_OF_DAY, type NoiseKey } from '../scales';
import type { ExchangeSpeech, TurnInput } from './types';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { met } from '../ruleset/hits';
import { busyCheck, checkNear, contact, startWatch, stepS, type NearStop } from './comingNear';
import { fightInSenses } from './mode';
import { applyNightPhase, hostilesNear, nextChange, planNight, settleSleepers, wakeByEvent, wakeCalls, wakeCheck, wakeChecksNear, wake } from './sleep';

/** CS5: how loud and how visible each engine-made event is (the spec's event noise and sight table); a kind not listed is quiet
 * and normal. Placeholders to tune. */
const SENSE: Record<string, [GameEvent['noise'], GameEvent['visibility']]> = {
  travel: ['quiet', 'normal'], attack: ['normal', 'high'], wasted: ['normal', 'high'], move: ['quiet', 'normal'], hold: ['silent', 'low'], speak: ['normal', 'normal'], call_help: ['loud', 'normal'], battle_cry: ['loud', 'high'], alarm: ['deafening', 'high'],
  rest: ['silent', 'low'], item_dropped: ['quiet', 'normal'], set_down: ['quiet', 'normal'], put_in: ['quiet', 'normal'], pick_up: ['quiet', 'normal'],
  way: ['quiet', 'normal'], pick: ['hushed', 'low'], break_open: [VOLUME_NOISE.shout, 'high'], // BF31: breaking a lock is heard like a shout // SD3–SD5: a key turned, a bar slid, a door tried; BA2: picking is a whisper
  stash: ['hushed', 'low'], // SE9: tucking something away
  filch: ['hushed', 'close'], // a filch's own contest sets both (src/engine/filch.ts)
};
/** AN2: event kinds that move the body, so worn armor makes them louder (CONFIG.ARMOR_NOISE_STEPS) */
const BODY_MOVING = new Set(['move', 'travel', 'attack', 'perk_move', 'break_free', 'restrain', 'pick_up']);
/** first build: checks only change beliefs (OQ-22). */
const CHECK_TYPES = new Set(['observe', 'interact', 'use_item', 'other']);

/** D-34 stub: every player action is major. */
export function isMajorAction(_event: GameEvent): boolean {
  return true;
}

/** AT19/AT20: an actor's move and main time left this turn, in seconds (two pools side by side), what of each carried in from
 * its last turn, and the seconds it has walked */
type Slots = { move: number; main: number; carried: { move: number; main: number }; walkedS: number; arrived?: boolean };
const T_EPS = 1e-6;
/** AT50: the round (ROUND_S) the action resolving now falls in, for once-a-round limits; keyed per actor */
const roundKey = (ctx: Ctx, id: string): string => `${id}@${Math.max(0, Math.ceil(ctx.at / CONFIG.ROUND_S - T_EPS) - 1)}`;
/** AT13/AT20: each pool holds the turn's seconds plus what carried from the actor's last turn */
const slotsOf = (ctx: Ctx, a: Actor): Slots => {
  let s = ctx.slots.get(a.id);
  if (!s) {
    const c = a.carry && a.carry.turn === ctx.state.turn - 1 ? a.carry : undefined;
    s = { move: ctx.turnS + (c?.move ?? 0), main: ctx.turnS + (c?.main ?? 0), carried: { move: c?.move ?? 0, main: c?.main ?? 0 }, walkedS: 0 };
    ctx.slots.set(a.id, s);
  }
  return s;
};
/** AT11/AT19: an action takes its seconds of main time, and the same of move time when it locks movement (unless the lock
 * was taken already). An action with no row, or longer than what is left, takes all that is left, as the one main action
 * did. False when no main time is left */
const useMain = (ctx: Ctx, a: Actor, cost?: { row?: DurationDef; seconds?: number; lockPaid?: boolean }): boolean => {
  const s = slotsOf(ctx, a);
  if (s.main <= T_EPS) return false;
  const seconds = cost?.seconds ?? (cost?.row ? actionSeconds(cost.row) : undefined);
  const take = seconds === undefined ? s.main : Math.min(s.main, seconds);
  s.main -= take;
  if (cost?.row?.locksMove && !cost.lockPaid) s.move = Math.max(0, s.move - take);
  ctx.clock.set(a.id, (ctx.clock.get(a.id) ?? 0) + take);
  payRow(ctx.state, a, cost?.row, take); // FT24: its effort tier's strain
  if (seconds !== undefined && seconds <= take + T_EPS) ctx.finished.add(a.id); else ctx.finished.delete(a.id);
  if (a === ctx.state.player && ctx.state.mode !== 'tactical') { const own = (ctx.own ??= { over: 0, fill: 0 }); if (seconds === undefined) own.fill += take; else own.over += seconds - take; }
  return true;
};
/** ZP2/AT19: a movement takes the move time left (a dash: the main time, once the move time is gone, when no main action
 * is planned); walkLegs gives back the seconds it doesn't walk. Null when neither is left */
const useMoveSlot = (ctx: Ctx, a: Actor, mainToo: boolean): Paid | null => {
  const s = slotsOf(ctx, a);
  if (s.move > T_EPS) { const seconds = s.move; s.move = 0; return { paid: 'move', seconds }; }
  if (mainToo && s.main > T_EPS) { const seconds = s.main; s.main = 0; return { paid: 'main', seconds }; }
  return null;
};
/** how a walk is paid: walked or run (a dash), its seconds, and the pool unwalked seconds go back to (none: a main action walked) */
type Paid = { paid: 'move' | 'main'; seconds: number; pool?: 'move' | 'main' | 'none' };
/** PO2: in a fight, the gear ops (before they are carried out) that reach into a pack `a` carries: drawing from it, moving
 * between it and a pocket, taking from a sack it carries */
function packOps(state: GameState, a: Actor, ops: GearOp[]): Set<GearOp> {
  if (state.mode !== 'tactical') return new Set();
  const inv = (id: string) => a.core.inventory.find((i) => i.id === id);
  return new Set(ops.filter((op) => {
    const i = inv(op.item);
    if (op.op === 'draw' || op.op === 'swap') return !!i && inPack(a, i);
    if (op.op === 'stow') return !!i && (op.into === POCKET ? inPack(a, i) : !!i.pocket && (!op.into || !!(findContainer(state, op.into)?.holder === a)));
    return op.op === 'pick_up' && !op.from && inContainer(state, a, op.item)?.c.holder === a;
  }));
}
/** AT11: seconds of the gear ops the actor carried out (draw, stow, swap, picking up), from its main time; a pick-up from the
 * ground locks movement too. PO2: one in `pack` takes the from_pack row first */
function useGearTime(ctx: Ctx, a: Actor, ops: GearOp[], pack: Set<GearOp> = new Set()): void {
  for (const op of ops) {
    const id = op.op === 'draw' ? DU.draw : op.op === 'stow' || op.op === 'set_down' ? DU.stow : op.op === 'swap' ? DU.swap : op.op === 'pick_up' ? (op.from ? DU.pick_up_reach : DU.pick_up_ground) : undefined;
    for (const row of [pack.has(op) ? actionRow(DU.from_pack) : undefined, id ? actionRow(id) : undefined]) {
    if (!row) continue;
    const s = slotsOf(ctx, a), take = Math.min(s.main, actionSeconds(row));
    s.main -= take;
    if (row.locksMove) s.move = Math.max(0, s.move - take);
    ctx.clock.set(a.id, (ctx.clock.get(a.id) ?? 0) + take);
    payRow(ctx.state, a, row, take);
    }
  }
}
/** AT11/AT19: a way op (a door, a bar, a key) takes its row's seconds from move time and main time; when the move time is
 * short and `mainToo` (nothing else planned) it takes main time only. False when neither has room */
function useWayTime(ctx: Ctx, a: Actor, op: WayOp, mainToo: boolean): boolean {
  const row = actionRow(op === 'lock' || op === 'unlock' ? DU.key : op === 'bar' || op === 'unbar' ? DU.bar : DU.door)!;
  const s = slotsOf(ctx, a), secs = actionSeconds(row);
  if (s.move + T_EPS < secs && !(mainToo && s.main + T_EPS >= secs)) return false;
  s.move = Math.max(0, s.move - secs);
  s.main = Math.max(0, s.main - secs);
  ctx.clock.set(a.id, (ctx.clock.get(a.id) ?? 0) + secs);
  payRow(ctx.state, a, row, secs);
  return true;
}
/** AT11: the Action times row an order's action uses, and its seconds (a crossbow's shot includes its spanning until
 * spanning is an action of its own); undefined when the order names no row (it takes the turn's main time) */
function orderCost(state: GameState, a: Actor, o: Order): { row: DurationDef; seconds: number } | undefined {
  const of = (id: string | undefined, extra = 0) => { const row = id ? actionRow(id) : undefined; return row ? { row, seconds: actionSeconds(row) + extra } : undefined; };
  const inv = (ref: string | null | undefined) => (ref ? a.core.inventory.find((i) => i.id === ref || i.itemId === ref) : undefined);
  switch (o.type) {
    case 'attack': {
      const m = attackMode(state, a, o).m;
      if (!m || m.mode.tree !== 'ranged') return of(DU.blow);
      if (m.mode.thrown) return of(DU.throw);
      const it = inv(m.itemId), def = it ? itemDef(state, it.itemId) : undefined;
      // AT11c: a crossbow spans, then shoots: one long action under the spanning row (its focus, its work kept when broken off)
      const span = def?.spanTime ? actionRow(def.spanTime) : undefined, shot = of(def?.shotTime ?? DU.bow_light);
      return span && shot ? { row: span, seconds: actionSeconds(span) + shot.seconds } : shot;
    }
    case 'use_item': { // PO2: in a fight, one in the pack is got out first
      const it = inv(o.item), heal = it ? itemDef(state, it.itemId).heal : undefined;
      const fetch = it && state.mode === 'tactical' && inPack(a, it) ? actionSeconds(actionRow(DU.from_pack)!) : 0;
      return of(heal === HL.bandage ? DU.bandage : heal === HL.draught ? DU.drink : undefined, fetch);
    }
    case 'hide': return of(DU.hide);
    case 'break': return of(DU.break_open); // BF31
    case 'rest': return of(DU.rest); // AT8: in a fight a long action; outside one the world clock runs it (runStretch)
    case 'search': case 'observe': return of(DU.look);
    case 'give': return of(DU.hand_over);
    case 'barter': case 'buy': case 'sell': return of(DU.trade);
    case 'equip': {
      const w = o.item ? itemDef(state, inv(o.item)?.itemId ?? o.item).armor?.weight : undefined;
      return of(w === 'heavy' ? DU.armor_heavy_on : w === 'medium' ? DU.armor_medium_on : w === 'light' ? DU.armor_light_on : undefined);
    }
    default:
      if (isSpeech(o.type) && o.line) { const row = actionRow(DU.talk)!; return { row, seconds: actionSeconds(row) * o.line.text.trim().split(/\s+/).length }; }
      return undefined;
  }
}

type Ctx = {
  state: GameState;
  rng: Rng;
  input: TurnInput;
  events: GameEvent[];
  orders: Map<string, Order>;
  acted: Set<string>;
  /** AT13: this turn's own seconds in each pool */
  turnS: number;
  /** AT19: move and main time left this turn, per actor (slotsOf fills them on first use) */
  slots: Map<string, Slots>;
  /** AT48: seconds into the turn each actor's main actions have reached; `at` is when the action resolving now finishes */
  clock: Map<string, number>;
  at: number;
  /** AT20: actors whose last action finished whole (their leftover carries); AT78: actors whose repeating order stopped */
  finished: Set<string>;
  stopped: Set<string>;
  /** speakers whose main action was their words in the exchange: their turn in order still runs gear, defence and move */
  spoke: Set<string>;
  surprised: Set<string>;
  defenses: Map<string, number>;
  exchangeEvents: GameEvent[];
  counters: Set<string>; // All-50 Counter: once per round (AT50), keyed by roundKey
  /** LR2: the attack about to resolve is One-Two's free Strike (read and cleared at the start of doAttack) */
  oneTwo?: boolean;
  parryStrikes: Set<string>; // PA4: a parry's free strike back, once per round (AT50), keyed by roundKey
  /** AT56: the player's rest, wait, walk or long action outside a fight: the world clock runs it at the end of the turn (runStretch) */
  stretch?: Stretch;
  /** TV1: the player's move this turn was a trip along a road (its own stops: nightfall, an encounter) */
  travelled?: boolean;
  /** AT46: outside a fight, the player's main time spent past the turn's pool (over) and taken by an action with no time
   * of its own (fill): what exploreSeconds measures the turn by */
  own?: { over: number; fill: number };
  /** BG-185: the player's walk taken before their words in the exchange (its move is then spent from the order) */
  saidOnWay?: Order;
};
/** AT56/AT65: a span of time the player's order covers, run by the world clock: its length, the pose it is spent in (how
 * soon the player is ready, AT67), and the event its outcome goes on */
type Stretch = { kind: 'rest' | 'wait' | 'walk' | 'busy'; seconds: number; pose: BodyPoseKey; ev: GameEvent; ran?: number; stop?: StretchStop; walk?: Order; order?: Order };
type StretchStop = NearStop | { why: 'fight'; by: string[] };

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
function initiativeOrder(state: GameState, ids: string[], orders: Map<string, Order>, rng: Rng): { order: string[]; delay: Map<string, number> } {
  const attackers = (id: string) => [...orders].filter(([, o]) => o.type === 'attack' && o.target === id).map(([by]) => actorById(state, by)!);
  const fight = state.mode === 'tactical';
  const delay = new Map<string, number>();
  const rows = ids.map((id) => {
    const a = actorById(state, id)!;
    const caught = attackers(id).some((x) => beliefStatus(state, a, x) === 'unaware' && !hearsItComing(state, a, x, armorNoise(state, x, 'attack', SENSE.attack[0])));
    // AT58: in a fight, the reaction rolled when the actor's fight started: its first turn starts that many seconds in, and
    // the roll orders it for the rest of the fight; outside a fight the roll is fresh each turn, as before
    let init: number, wait = 0;
    if (!fight) init = ruleset.initiative(a, state, rng);
    else {
      const fresh = !a.react || a.react.turn !== state.turn - 1;
      if (fresh) { const total = ruleset.initiative(a, state, rng); a.react = { s: reactSeconds(total), init: total, turn: state.turn }; }
      else a.react!.turn = state.turn;
      init = a.react!.init;
      if (fresh) wait += a.react!.s;
    }
    // AT60/LI1c: a believed Bluff makes it hesitate: its turn starts after its reaction time again
    if (bluffed(state, a)) { wait += a.react?.s ?? reactSeconds(init); spendBluff(a); }
    if (wait > 0) delay.set(id, wait);
    return { id, caught, wait, init, tie: rng.next() };
  });
  // the unaware act last (Q2); then whoever starts first; ties by the roll
  rows.sort((x, y) => +x.caught - +y.caught || x.wait - y.wait || y.init - x.init || y.tie - x.tie);
  return { order: rows.map((r) => r.id), delay };
}

// ---------- after each event ----------

function emit(ctx: Ctx, ev: GameEvent, result?: CheckResult | ContestResult | AttackResult, perceived = false): void {
  const { state, rng } = ctx;
  // BG-163: an action out of reach says how far short it fell (metres), so the story never turns a step into a way off
  if (ev.kind === 'wasted' && ev.reason === 'out_of_reach' && ev.metres === undefined) {
    const a = actorById(state, ev.actorId), o = ctx.orders.get(ev.actorId), near = a && o ? reachOf(state, a, o) : null;
    if (a && near) ev.metres = Math.round(Math.max(0, distM(state, a, near.at) - near.m) * 10) / 10;
  }
  // BG-181: an NPC keeps its last wasted try (and why) in mind until it next does that kind of thing
  const m = actorById(state, ev.actorId)?.mind, tried = ctx.orders.get(ev.actorId)?.type;
  if (m && tried && ev.kind === 'wasted' && ev.reason) m.lastWasted = { turn: state.turn, action: tried, reason: ev.reason };
  else if (m?.lastWasted && ev.kind === m.lastWasted.action) delete m.lastWasted;
  // BG-132: one order's words are said once a turn, whichever of its events carries them first
  if (ev.line && ev.bark && ctx.events.some((e) => e.actorId === ev.actorId && e.line?.text === ev.line!.text)) { delete ev.line; delete ev.bark; }
  // BF3: a whisper to someone it does not reach, even after stepping up, is said low enough for them to hear; BG-154: to
  // each one it is for (line.to, the target of a speak, everyone it addresses)
  const tos = ev.line?.volume === 'whisper' ? [ev.line.to, ev.kind === 'speak' ? ev.target : undefined, ...(ev.speech?.addressees ?? [])] : [];
  for (const to of new Set(tos.map((id) => id && actorById(state, id)).filter((x): x is Actor => !!x && x.id !== ev.actorId))) {
    const n = carryingNoise(state, ev, to);
    if (NOISE.pos(n) > NOISE.pos(ev.noise)) { ev.noise = n; logCode(state, 'whisper_raised', { actorId: ev.actorId, to: to.id, noise: n }); }
  }
  wakeByEvent(state, ev); // NW18: a blow or a loud noise wakes sleepers first, so they hear what woke them
  if (!perceived) ev.perception = computePerception(ev, state, rng);
  noteSightings(ev, state);
  updateBeliefs(state, { kind: 'event', event: ev, result });
  if (ev.actorId === state.player.id && isMajorAction(ev)) detectPlayer(state, ev, rng);
  else if (isMajorAction(ev) && actorById(state, ev.actorId)?.posture === 'stealthy') {
    stealthDetect(state, ev, rng); // NS2
    // BG-64: whoever just spotted the stealthy actor perceives the very deed they spotted it by (a filch has its own contest)
    if (ev.kind !== 'filch') for (const [id, p] of Object.entries(computePerception(ev, state, rng))) ev.perception[id] ??= p;
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
    // CS5: a bandmate must perceive the attack fully (a partial event names no attacker)
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
  { const f = getLibrary().fears?.[id]; if (f?.rolled && !f.unengaged && !isEngaged(state, a)) return; } // the player too (MB11): isEngaged reads who is fighting them
  const r = payFear(state, ctx.rng, a, id, o);
  if (!r) return;
  // SP5: in a spar with no real foe, a surrender or a break just yields the spar
  if (sparOf(state, a.id) && !allActors(state).some((x) => x !== a && isActive(x) && (hostile(state, a, x) || hostile(state, x, a)))) { yieldSpar(state, a); return; }
  if (a === state.player) { tally(state, 'morale_breaks'); return; } // MB12: you keep control but cannot attack (doAttack)
  loseNerve(state, a, r);
  // BF37: broken, what it has yet to do loses any walk, attack or perk move (cowering if nothing is left); surrendered, it holds
  if (!ctx.acted.has(a.id) && ctx.orders.has(a.id)) { const v = buildActorView(state, a.id); ctx.orders.set(a.id, v.self.broken && !v.self.surrendered ? nerveHolds(ctx.orders.get(a.id)!).order : brokenOrder(v)); }
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
  return { ...ev, line: { text: o.line.text, volume: o.line.volume, ...(o.line.to ? { to: o.line.to } : {}) }, bark: true, noise: NOISE.pos(voice) > NOISE.pos(ev.noise) ? voice : ev.noise };
}

/** ZP2: one leg of a move toward `goal` (a zone, or a point to stop `stopShort` short of): up to the next doorway, or
 * within the goal's zone straight at its point (position.ts walkLeg). Returns the metres walked (0: none), 'spent' when
 * the move is used up where the actor stands (held: its try to break free; a frontier), or null when it is dropped
 * (frontier for an NPC, no path). */
function doMove(ctx: Ctx, a: Actor, goal: Located, o: Order, withBark: boolean, metres: number, stopShort = 0, toward?: string, spot?: string): number | 'spent' | null {
  const { state } = ctx;
  if (goal.zone === a.zone && !goal.pos) return 0;
  // A8 Hold: a held actor's move is its try to break free; it stays in the zone either way
  const bf = a.heldBy ? breakFree(state, a, ctx.rng) : null;
  if (bf) {
    const ev = mk(ctx, a, 'break_free', { target: String(bf.effect.data.by), effects: [bf.effect] });
    emit(ctx, withBark ? bark(ev, o) : ev);
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
    // CS5: the player crossing a frontier stays in its zone; scenario setup or the stage extension places them (pipeline reads scratch)
    state.scratch = { ...(state.scratch ?? {}), frontierCrossed: goal.zone };
    const ev = mk(ctx, a, 'move', { target: goal.zone, effects: [{ kind: 'frontier_crossed', actorId: a.id, data: { frontier: goal.zone } }] });
    emit(ctx, withBark ? bark(ev, o) : ev);
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
    const ev = mk(ctx, a, 'move', { metres: 0, fromZone: up.id, ...(was ? { fromPos: was } : {}), fall: { metres: drop, damage: f.damage, landing: f.landing }, effects: f.effects });
    emit(ctx, withBark ? bark(ev, o) : ev);
    return 'spent';
  }
  const from = a.zone, fromPos = a.pos && { ...a.pos };
  // SD3–SD5: a barrier not open to the walker on the next way: walk up to it, then open it (a key, the bolt's side) or try it
  const gate = gateAhead(state, a, goal.zone);
  const round = roundShut(state, a, goal.zone);
  const walked = walkLeg(state, a, goal, metres, stopShort, a, !!gate);
  if (walked === null) return null;
  if (gate && walked <= 0) return gate.pass === 'shut' && a.kind !== 'player' && gate.b.tried?.includes(a.id) ? null : atBarrier(ctx, a, gate, withBark ? o : undefined); // an NPC tries a shut way once
  if (walked <= 0 && a.zone === from) return 0; // a doorway right where the walker stands is crossed in 0 m: still a move
  if (a === state.player && a.zone !== from) noteLeft(state, from);
  // a leg inside the zone (closing in, a step) names who it heads for and carries no fromZone; every leg keeps where it set off
  const leg = { metres: r1(walked), ...(fromPos ? { fromPos } : {}), ...(a.zone !== from ? { fromZone: from } : toward ? { target: toward, ...(goal.zone !== a.zone ? toGo(state, a, goal.zone) : reachedSpot(a, goal, stopShort) ? { beside: true as const } : {}) } : goal.zone !== a.zone ? { heading: goal.zone, ...toGo(state, a, goal.zone) } : {}), ...(spot && a.zone === goal.zone ? { spot: reachedSpot(a, goal, stopShort) ? spot : spotOnTheWay(spot), ...(o.moveSpot?.lastSeen && o.moveSpot.near ? { lastSeenOf: o.moveSpot.near } : {}) } : {}) };
  let ev = withActivity(ctx, a, mk(ctx, a, 'move', { ...leg, ...(round ? { round } : {}), ...(o.vanish ? { vanish: true as const } : {}) }), o.activity);
  if (withBark) ev = bark(ev, o);
  emit(ctx, ev);
  return walked;
}

/** BG-148: the way straight into `goal` that the walker knows is shut, when its walk goes round it instead: never silent */
function roundShut(state: GameState, a: Actor, goal: string): { way: string; shut: 'blocked' | 'barred' | 'locked' } | undefined {
  const l = zoneById(state, a.zone)?.links.find((x) => x.to === goal), b = barrierOn(state, l);
  if (!l || !b || passage(b, a, a.zone) !== 'shut' || !knowsShut(state, b, a, a.zone) || wayPath(state, a.zone, goal, a)?.[0] === goal) return undefined;
  return { way: l.label, shut: shutBy(b, a, a.zone) };
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
function atBarrier(ctx: Ctx, a: Actor, g: NonNullable<ReturnType<typeof gateAhead>>, withLine?: Order): 'spent' {
  const did = g.pass === 'opens' ? openWay(g.b, a, a.zone) : [];
  if (g.pass === 'shut') noteTried(g.b, a);
  const way = (d: WayDid, i: number) => { const ev = mk(ctx, a, 'way', { target: g.to, way: { to: g.to, barrier: g.b.id, did: d } }); return withLine && i === 0 ? bark(ev, withLine) : ev; };
  if (did.length) did.forEach((d, i) => emit(ctx, way(d, i)));
  else emit(ctx, way(`found_${shutBy(g.b, a, a.zone)}` as WayDid, 0));
  return 'spent';
}

/** BG-111: where an order's move goes: its zone, or the spot in it (beside someone, by a way out, a side) with the walk's
 * stop-short and words. The one rule for every walk an order makes: the player's, an NPC's in turn, a spokesperson's in the
 * exchange. */
function moveGoal(state: GameState, a: Actor, o: Order): { goal: Located; opts: { stopShort?: number; toward?: string; spot?: string; enter?: boolean } } {
  // BG-131: a walk beside someone goes where they are when it runs: someone the walker still perceives, who moved off
  // since the order was made, takes the walk to their zone now
  const who = o.moveSpot?.near && !o.moveSpot.lastSeen ? actorById(state, o.moveSpot.near) : undefined;
  const zone = who && who !== a && who.zone !== o.move && perceivesNow(state, a, who, 'faint') ? who.zone : o.move;
  const sp = zone && o.moveSpot ? spotPoint(state, zone, o.moveSpot, a) : null;
  if (o.moveSpot && !sp) logCode(state, 'move_spot_dropped', { actorId: a.id, to: zone, spot: o.moveSpot });
  return {
    goal: sp ? { zone: zone!, pos: sp.pos } : { zone: zone! },
    opts: sp ? { stopShort: sp.stopShort, ...(sp.toward ? { toward: sp.toward } : {}), ...(sp.words ? { spot: sp.words } : {}), enter: true } : {},
  };
}

/** ZP2: walks toward `goal` on move slots: each slot walks slotMetres of it (a move slot walks; a main slot spent on it, a
 * dash, runs the rest of the turn), one leg at a time, until it gets there, the slots run out, or the move is spent or
 * dropped. `slot` pays for each new slot (null: none left); with `stopShort`, the walk ends that far from the goal's point
 * (closing in to strike). Returns false when the move was dropped. */
function walk(ctx: Ctx, a: Actor, goal: Located, o: Order, slot: (n: number) => Paid | null, opts: { bark?: boolean; stopShort?: number; toward?: string; spot?: string; enter?: boolean } = {}): boolean {
  const start = ctx.events.length;
  const ok = walkLegs(ctx, a, goal, o, slot, opts);
  // BG-118: words said with a move are never lost: a move that left no event to carry them (a wait at a frontier, a
  // dropped walk, a doorway underfoot) still says them, standing where the walker is
  if (opts.bark && o.line && !ctx.events.slice(start).some((e) => e.actorId === a.id && e.line)) emit(ctx, bark(mk(ctx, a, 'hold'), o));
  return ok;
}

function walkLegs(ctx: Ctx, a: Actor, goal: Located, o: Order, slot: (n: number) => Paid | null, opts: { bark?: boolean; stopShort?: number; toward?: string; spot?: string; enter?: boolean }): boolean {
  const { state } = ctx;
  // BG-166: a move goes into the zone it names, even when its spot is already within reach from the edge of the next one
  const there = () => (!opts.enter || a.zone === goal.zone) && (goal.pos ? withinM(distM(state, a, goal), opts.stopShort ?? 0) : a.zone === goal.zone);
  // AT19: the seconds not walked go back to the pool they came from; seconds walked count toward when the actor's next action finishes
  let paid: Paid | null = null, perS = 0;
  const giveBack = (metres: number) => {
    if (!paid || perS <= 0) return;
    const s = slotsOf(ctx, a), back = Math.max(0, Math.min(paid.seconds, metres / perS));
    if (paid.pool !== 'none') s[paid.pool ?? paid.paid] += back;
    s.walkedS += paid.seconds - back;
    payMove(state, a, paid.paid, paid.seconds - back); // FT24: a walk is Base, a run (dash) Hard
    if (there()) s.arrived = true;
  };
  let left = 0;
  try { return walkOn(); } finally { giveBack(left); }
  function walkOn(): boolean {
  let fresh = false;
  for (let n = 0, legs = 0; !there() && legs < 100; legs++) {
    if (left <= M_EPS) {
      if (paid) giveBack(left);
      left = 0;
      paid = slot(n++);
      if (!paid) return true;
      if (paid.paid === 'main' && lame(state, a)) { logCode(state, 'dash_blocked', { actorId: a.id, reason: slowed(state, a) ? 'slowed' : 'crippled_leg' }); return true; }
      if (paid.paid === 'main' && tooSpent(a, runEffort(a))) { logCode(state, 'dash_blocked', { actorId: a.id, reason: 'spent' }); slotsOf(ctx, a).main += paid.seconds; paid = null; return true; } // FT10: no run, its time kept
      perS = slotMetres(state, a, paid.paid, 1);
      left = perS * paid.seconds;
      fresh = true;
    }
    const zone = a.zone;
    const r = doMove(ctx, a, goal, o, !!opts.bark && legs === 0, left, opts.stopShort ?? 0, opts.toward, opts.spot);
    if (r === null) return false;
    if (r === 'spent') return true;
    if (r === 0 && a.zone !== zone) continue; // BG-170: a 0 m doorway crossing walked nothing, so the walk goes on with what is left
    if (r === 0) { if (fresh) return true; left = 0; continue; }
    left -= r;
    noteWalked(state, a, r); // NW11: what this turn's own moves already walked
    fresh = false;
  }
  return true;
  }
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

/** TF16: a stand-down, as an event the people there can see: who stood down, from whom, who went with it */
function emitStandDown(ctx: Ctx, d: StoodDown): void {
  emit(ctx, mk(ctx, d.who, 'stand_down', { target: d.from.id, standDown: { with: d.with, ...(d.coin ? { coin: d.coin } : {}) } }));
}

/** TF19: a surrender talked out of a foe, as an event the people there can see; those who gave up act no more this turn */
function emitTalkedYield(ctx: Ctx, d: TalkedYield): void {
  for (const id of [d.who.id, ...d.with]) if (!ctx.acted.has(id) && ctx.orders.has(id)) ctx.orders.set(id, brokenOrder(buildActorView(ctx.state, id)));
  emit(ctx, mk(ctx, d.who, 'surrender', { target: d.from.id, surrender: { with: d.with } }));
}

/** TF13/TF17/TF10: the player's persuasion, lie or bribe at foes in a fight is an offer to stop: each listener that made
 * out the words answers it (makeOffer), for its bandmates who heard the words too (TF6) */
function playerOffers(ctx: Ctx, ev: GameEvent, ex: ExchangeSpeech): void {
  const { state } = ctx;
  for (const [sp, r] of Object.entries(ex.perSpokesperson)) {
    const to = actorById(state, sp);
    const o = to && playerOffer(state, ctx.input.intent, to);
    if (!to || !o) continue;
    const heard = state.actors.filter((m) => m !== to && m.bandId === to.bandId && hearsWords(ev.perception[m.id])).map((m) => m.id);
    const res = makeOffer(state, state.player, to, o.type, r.contest, heard, o.coin, o.kind);
    (ev.offers ??= []).push({ to: sp, landed: res.landed, ...(o.kind === 'yield' ? { demand: o.kind } : {}) });
    if (res.stood) emitStandDown(ctx, res.stood);
    if (res.yielded) emitTalkedYield(ctx, res.yielded);
  }
}

function doSpeak(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  // BG-50: a speak with no words (a code-run beat, or a call that gave no line) carries no line at all, never an empty one
  const line = o.line?.text?.trim() ? o.line : undefined;
  const ev = mk(ctx, a, 'speak', { target: o.target ?? undefined, ...(line ? { line } : {}), noise: VOLUME_NOISE[line?.volume ?? 'normal'] });
  if (a.kind === 'player') ev.speech = { skill: speechSkillOf(o.type), addressees: o.addressees ?? [] };
  // OQ-29: an NPC's persuade, deceive, intimidate or barter at the player rolls when the player hears it; the player answers.
  // NL1/NL2: a lie at another NPC rolls the same way (D-155: other speech at NPCs stays banked)
  const p = state.player;
  // NM3: a false name for itself is a lie, even if the agent called it talk, so it can be caught (backstop to PUSH_RULE)
  const type = o.type === 'talk' && falseName(a, line?.text) ? 'deceive' : o.type;
  const to = o.target ? actorById(state, o.target) : undefined;
  const push = a.kind === 'npc' && !!to && to !== a && isActive(to) && (to === p ? PUSH_TYPES.includes(type) : type === 'deceive');
  if (push) {
    ev.perception = computePerception(ev, state, ctx.rng);
    if (hearsWords(ev.perception[to.id])) {
      const contest = pushContest(state, a, type, ctx.rng, to);
      ev.contest = contest;
      ev.push = { type, listener: to.id, landed: contest.winner === 'a', ...applySpeech(a, to, type, contest),
        ...(atLeast(beliefStatus(state, a, to), 'aware') ? { seen: true as const } : {}) }; // NT10: the speaker sees how it was taken
      if (ev.push.status === 'shaken') fear(ctx, to, FR.lost_intimidation, { gap: contest.gap }); // MB15/MB28
      // TF11: a persuasion or lie at the player in a fight is an offer to stand down; the player answers by saying so
      if (to === p && OFFER_TYPES.includes(type) && type !== 'barter' && canOffer(state, a, p)) ev.push.offer = makeOffer(state, a, p, type, contest, []).landed;
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

/** followUp: a free attack another perk gave (One-Two's punch, a parry's strike back); flurry: Flurry's own free strike */
function doAttack(ctx: Ctx, a: Actor, o: Order, followUp = false, flurry = false): void {
  const { state, rng } = ctx;
  const oneTwo = !!ctx.oneTwo;
  ctx.oneTwo = false;
  let t = o.target ? actorById(state, o.target) : undefined;
  // BG-25: a wasted attack says why, so the story tells that and not a miss it made up
  const wasted = (reason: string) => emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason }), o));
  // BG-25: someone down (Incapacitated) can still be struck: HP lost keeps counting while down, to Dead. Only the dead can't.
  if (!t || t === a) return wasted('no_target'); // BG-149: always a reason
  if (healthLevel(t) === 'dead') return wasted('already_dead');
  if (t === state.player && !isActive(t)) return wasted('already_down'); // a downed player's fate is the survival roll's (D-54)
  if (a === state.player && moraleLevel(a) === 'broken') { logCode(state, 'broken_no_attack', { actorId: a.id }); return wasted('nerve_broken'); } // MB12
  if (yieldBars(state, a, t)) { logCode(state, 'yield_no_attack', { actorId: a.id, target: t.id }); return wasted('yielded_to'); } // MB43
  if (truceBars(state, a, t)) { logCode(state, 'truce_no_attack', { actorId: a.id, target: t.id }); return wasted('truce'); } // TF16
  if (heldBack(state, a, t)) { logCode(state, 'spar_blow_held', { actorId: a.id, target: t.id }); return wasted('spar_held'); }
  const dist = sightDistM(state, a, t);
  if (notInHand(state, a, o)) return wasted('not_in_hand'); // BG-186: never a fist in its place
  const named = namedMode(state, a, o);
  // a named skill picks the mode that uses it ("I grab him" names unarmed_grapple, not the sword in hand)
  const bySkill = !named && o.skill ? usableModes(state, a).find((x) => modeSkill(x.mode) === o.skill && withinM(dist, x.mode.reach)) : undefined;
  const m = named ?? bySkill ?? defaultMode(state, a, dist);
  // target moved first: resolves only within the mode's reach (metres, with sight); else a wasted action
  if (!m || !withinM(dist, m.mode.reach)) return wasted('out_of_reach');
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
  const cover = coverFor(state, t, m.mode.tree === 'ranged'); // LR4 Bulwark: melee too
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
  const before = { level: healthLevel(t), parts: partStates(state, t), lost: t.core.condition.hpLostPct, active: isActive(t) };
  // BG-207 (BF30): someone down, asleep or held in a grip can't defend: the defense fails outright
  const helpless = !isActive(t) ? 'down' as const : isAsleep(t) ? 'asleep' as const : t.heldBy ? 'held' as const : undefined;
  const opening = openingShifts(ctx, a, t, m.mode.tree);
  // LR1 Ghost Blade: Hidden Strike also lands on a target only suspicious of the owner, once per target per engagement
  if (!surprised && hasPerk(a, PK.ghost_blade) && beliefStatus(state, t, a) === 'suspicious' && onceThisEngagement(state, a, `${PK.ghost_blade}:${t.id}`)) {
    opening.attackerShifts = [...(opening.attackerShifts ?? []), { source: 'Ghost Blade', value: 1 }];
  }
  gaveUpFeats(state, a, t); // AS1–AS11: striking someone who already gave up, before this blow changes anything
  if (flurry) opening.attackerShifts = [...(opening.attackerShifts ?? []), { source: 'Flurry', value: -1 }]; // AT79: one tier less sure
  const res = ruleset.attack(
    { attackerId: a.id, targetId: t.id, weaponId: m.itemId, modeId: m.mode.id, targetPart: o.targetPart ?? null, aimed: !!o.aimed,
      context: { defenderUnaware: surprised, ...(helpless ? { helpless } : {}), defensesThisTurn: ctx.defenses.get(roundKey(ctx, t.id)) ?? 0, ...opening } },
    state, rng,
  );
  if (res.defense && !helpless) { ctx.defenses.set(roundKey(ctx, t.id), (ctx.defenses.get(roundKey(ctx, t.id)) ?? 0) + 1); payStrain(state, t, CONFIG.DEFENSE_EFFORT); } // FT5: a dodge, block or parry
  ev.effects = [...ev.effects, ...ruleset.applyEffects(res, state)];
  afterAttack(state, a, t, res, m.mode.tree === 'ranged', modeSkill(m.mode), oneTwo); // perk marks (A2, A5, A10, B15, LR2)
  const hold = applyHold(a, t, res, modeSkill(m.mode)); // A8 Hold
  if (hold) ev.effects.push(hold);
  ruleset.recordUse(a, res.attack.skill, res, state);
  markEndurance(state, t, t.core.condition.hpLostPct - before.lost);
  if (spar) checkOut(state, spar); // SP4: at the limit, the fighter is out: a later blow on it is a real attack (SP7)
  ev.tier = res.attack.tier;
  ev.attack = res;
  breakFocus(ctx, t, ev, t.core.condition.hpLostPct > before.lost);
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
  if (!isActive(t) && before.active) { // newly down: a blow on someone already down downs no one
    if (isActive(a) && !a.mind?.moraleState) calm(state, a, CP.foe_downed); // TM28: a composure row, so it counts as calmed
    for (const p of allActors(state)) if (p !== t && !!t.bandId && p.bandId === t.bandId && ev.perception[p.id]) fear(ctx, p, FR.bandmate_down, {}, ev.perception);
  }
  // B16 One-Two: an improvised hit with a Grip part free is followed by a free punch at the same foe
  if (!followUp && modeSkill(m.mode) === SK.unarmed_improvised && met(res.outcome) && hasPerk(a, PK.one_two)
    && isActive(t) && freeHand(state, a)) {
    const fist = usableModes(state, a).find((x) => modeSkill(x.mode) === SK.unarmed_strike && x.mode.reach >= 0);
    if (fist && withinM(sightDistM(state, a, t), fist.mode.reach)) { ctx.oneTwo = true; doAttack(ctx, a, { ...o, target: t.id, item: fist.itemId, mode: fist.mode.id, skill: SK.unarmed_strike, targetPart: null, aimed: false, line: null }, true); }
  }
  // AT79 Flurry: every unarmed strike thrown with two Grip parts free, hit or miss, brings one free strike at the same target
  // at once (no time, no action). Its own free strike never sets it off again; One-Two's free punch does
  if (!flurry && modeSkill(m.mode) === SK.unarmed_strike && hasPerk(a, PK.flurry) && isActive(t) && freeGrips(state, a) >= 2
    && withinM(sightDistM(state, a, t), m.mode.reach)) doAttack(ctx, a, { ...o, target: t.id, item: m.itemId, mode: m.mode.id, skill: SK.unarmed_strike, targetPart: null, aimed: false, line: null }, followUp, true);
  allFiftyAfterAttack(ctx, a, t, m.mode.tree === 'ranged', m.itemId, res, fromHiding, followUp);
  parryStrike(ctx, a, t, res);
}

/** PA4: a parry at the strike gap or better gives the defender one free melee attack back at the attacker, with the
 * parrying weapon (a fist after a barehanded parry), once per turn. A free attack can earn one too: once per turn ends the chain. */
function parryStrike(ctx: Ctx, a: Actor, t: Actor, res: AttackResult): void {
  const { state } = ctx;
  if (!res.strikeBack || !isActive(t) || !isActive(a) || ctx.parryStrikes.has(roundKey(ctx, t.id))) return;
  const weapon = parryItem(state, t);
  const modes = usableModes(state, t);
  const back = weapon ? modes.find((x) => x.itemId === weapon.id && x.mode.tree === 'melee' && x.mode.reach >= 0)
    : modes.find((x) => modeSkill(x.mode) === SK.unarmed_strike && x.mode.reach >= 0);
  if (!back || !withinM(sightDistM(state, t, a), back.mode.reach)) return; // the blow back reaches only as far as its weapon (metres)
  ctx.parryStrikes.add(roundKey(ctx, t.id));
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
    && !ctx.counters.has(roundKey(ctx, t.id))) {
    const back = defaultMode(state, t, sightDistM(state, t, a));
    if (back && back.mode.tree !== 'ranged') {
      ctx.counters.add(roundKey(ctx, t.id));
      doAttack(ctx, t, { ...nullOrder(t.id), type: 'attack', target: a.id, item: back.itemId, mode: back.mode.id }, true);
    }
  }
  // T2b Volley: once per engagement, after a ranged hit, a free shot at a foe already fighting the owner (hostile, or sparring) that it sees
  if (ranged && met(res.outcome) && hasPerk(a, PK.volley) && isActive(a) && readyThisEngagement(state, a, PK.volley)) {
    const mode = usableModes(state, a).find((x) => x.itemId === itemId && x.mode.tree === 'ranged');
    const foes = allActors(state).filter((x) => x !== a && isActive(x) && foe(state, x, a) && atLeast(beliefStatus(state, a, x), 'aware')
      && withinM(sightDistM(state, a, x), mode?.mode.reach ?? -1));
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

/** Rest (H5): at most once every REST_COOLDOWN_MIN game minutes (T7); it can always be started (AT8). Outside a fight the
 * player's rest runs on the world clock at the end of the turn and heals by the share of it that ran (runStretch); in a
 * fight it is a long action, done when its time is (an NPC's rest heals at once). */
function doRest(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  const key = `rest:${a.id}`;
  const last = state.clocks[key];
  const ev = bark(mk(ctx, a, 'rest'), o);
  if (last !== undefined && now(state) - last < CONFIG.REST_COOLDOWN_MIN) {
    logCode(state, 'rest_blocked', { actorId: a.id, reason: 'cooldown' });
  } else if (a === state.player && state.mode !== 'tactical') {
    ctx.stretch = { kind: 'rest', seconds: actionRow(DU.rest)?.seconds ?? 0, pose: 'lying', ev };
  } else {
    // H1/H6: resting in a place whose kind a healing row names (a clinic) uses that row, once paid for (PY8), else the rest row
    const row = restRow(state, a);
    applyHealing(state, a, row);
    restRecover(state, a, 1);
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
 * Either can always be started (AT8): a wait runs on the world clock at the end of the turn and stops when the clock
 * pauses (runStretch); in a fight the clock is already paused, so it does nothing. A time skip never ends the scenario. */
function doWait(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  if (a !== state.player) return hold(ctx, a, o);
  const ev = bark(mk(ctx, a, o.type), o);
  if (state.mode === 'tactical') {
    logCode(state, 'wait_blocked', { actorId: a.id, reason: 'fight' });
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
      // NW12/NW15: the night: alone, until rested (FT9) or the time named; with companions, one watch each. "Sleep" again
      // during a night that was stopped (on watch, or after someone came and went) carries it on.
      const sleepMin = named ? minutesUntil(t, named) : sleepMinutes(state, a);
      if (!state.night) state.night = planNight(state, sleepMin, allActors(state).filter((x) => x !== a && isActive(x) && !isAsleep(x) && x.zone === a.zone && x.bandId === a.bandId && !!x.mind?.routine && routine(x.mind.routine.id).kind === 'follow'));
      logCode(state, 'night_started', { actorId: a.id, end: state.night.end, watches: state.night.watches });
      runNight(ctx);
    } else {
      ctx.stretch = { kind: 'wait', seconds: minutesUntil(t, until) * 60, pose: 'standing', ev }; // its time and outcome come from runStretch
      return emit(ctx, ev);
    }
    const minutes = now(state) - t;
    logCode(state, 'time_passed', { actorId: a.id, minutes, from: t, to: now(state) });
    ev.effects.push({ kind: 'time_passed', actorId: a.id, data: { minutes } }); // SC4/SC9: a time skip never ends the scenario
  }
  emit(ctx, ev);
}

/** AT45/AT49: the player's walk, one stretch step of `seconds` at a walk; true once it is there or can go no further */
function walkStep(ctx: Ctx, o: Order, seconds: number): 'there' | 'blocked' | null {
  const { state } = ctx;
  const p = state.player;
  const { goal, opts } = moveGoal(state, p, o);
  const was = { zone: p.zone, pos: p.pos && { ...p.pos } };
  const from = ctx.events.length;
  const ok = walk(ctx, p, goal, o, (n) => (n === 0 ? { paid: 'move', seconds, pool: 'none' } : null), opts);
  if (foundShut(ctx.events.slice(from), p)) return 'blocked';
  const moved = p.zone !== was.zone || (!!p.pos && !!was.pos && distM(state, p, { zone: p.zone, pos: was.pos }) > M_EPS);
  return walkThere(state, p, o) ? 'there' : !ok || !moved ? 'blocked' : null;
}
/** BG-190: a walk with spot near someone and follow set is a follow. Reaching them does not end it: it carries on next
 * turn (AT49) toward where they are now while the player can see or hear them. Lost, it ends and the player is told why
 * (Actor.followLost): seen going down, slipped from sight in the zone the player had them in, or gone on out of sight */
function keepFollowing(ctx: Ctx, wo: Order | undefined): void {
  const { state } = ctx;
  const p = state.player, spot = wo?.moveSpot;
  const who = spot?.follow && spot.near ? actorById(state, spot.near) : undefined;
  if (!wo?.move || !who || who === p || wo.way || ctx.travelled || !isActive(p) || !ctx.acted.has(p.id) || foundShut(ctx.events, p)) return;
  if (ctx.stretch && ctx.stretch.kind !== 'walk') return; // another long thing to do ends it, as any walk
  const seen = perceivesNow(state, p, who, 'faint');
  // BG-203: a follow of someone out of sight walks to where the player last saw them; seen or heard on the way, it is a
  // follow of them again from the next turn. Not found there, they are lost; not there yet, the walk goes on
  if (seen && isActive(who)) { p.walking = walkOf({ ...wo, move: who.zone, moveSpot: { near: who.id, follow: true } }); return; }
  if (spot!.lastSeen && p.walking) return;
  delete p.walking;
  p.followLost = { who: who.id, why: seen ? 'down' : who.zone === wo.move && p.zone === wo.move ? 'slipped_away' : 'out_of_sight', zone: wo.move };
  logCode(state, 'follow_lost', { actorId: p.id, ...p.followLost });
}
/** BG-69: the walker found a way shut (barred, locked, stuck): the walk ends there, for the player to choose again */
const foundShut = (events: GameEvent[], a: Actor): boolean => events.some((e) => e.actorId === a.id && e.kind === 'way' && !!e.way?.did.startsWith('found_'));
/** the walk's goal reached: in its zone, and at its spot when it names one */
function walkThere(state: GameState, a: Actor, o: Order): boolean {
  const { goal, opts } = moveGoal(state, a, o);
  return a.zone === goal.zone && (!goal.pos || withinM(distM(state, a, goal), opts.stopShort ?? 0));
}
/** the move to carry on (AT49), as the Parser gave it */
const walkOf = (o: Order): NonNullable<Actor['walking']> => ({ toZone: o.move!, ...(o.moveSpot ? { spot: o.moveSpot } : {}), ...(o.jump ? { jump: true } : {}) });
/** AT49: a walk carries on while the player orders neither a move nor an action (words are said on the way, and a sneak,
 * BG-190, sneaks along it); anything else stops it */
function carryOnWalk(state: GameState, intent: Intent | null): Intent | null {
  const p = state.player;
  delete p.followLost; // BG-190: told once, the turn after it was lost
  if (!p.walking || !intent) return intent;
  if (!intent.move && (!intent.action || isSpeech(intent.action.type) || intent.action.type === 'sneak')) return { ...intent, move: p.walking };
  delete p.walking;
  return intent;
}

/** AT55/AT63/AT66: in a stretch of time, NPCs after someone (engaged or hunting: catchUp leaves them alone) follow their
 * fallback orders on code, with no Planner calls. Seeing whom they are after tells them where they are; a move or a search
 * walks toward that zone at a run (a dash, as a turn with no action); an attack walks up to the target and, in reach,
 * strikes as in a turn (doAttack, one blow a round). A foe in reach of the player strikes no blow here: the stretch stops
 * (contact) and the next turn is a fight. Returns who reached the player and whether a fight between NPCs is on. */
function huntOnCode(ctx: Ctx, seconds: number, onLeg?: OnLeg): { reached: string[]; fighting: boolean } {
  const { state, rng } = ctx;
  const p = state.player;
  const reached: string[] = [];
  let fighting = false;
  for (const x of [...state.actors].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!x.mind || !isActive(x) || isAsleep(x) || x.heldBy || x.mind.moraleState || busyNow(x) || !isEngaged(state, x)) continue;
    for (const [id, b] of Object.entries(x.mind.knowledge)) {
      const t = actorById(state, id);
      if (t && isActive(t) && atLeast(b.status, 'suspicious') && perceivesNow(state, x, t, 'faint')) {
        updateBeliefs(state, { kind: 'opening', observerId: x.id, aboutId: id, status: atLeast(b.status, 'aware') ? b.status : 'aware', zone: t.zone });
      }
    }
    const o = fallbackOrder(buildActorView(state, x.id), rng);
    const t = o.target ? actorById(state, o.target) : undefined;
    const walk = (goal: Located, short = 0) => {
      const from: Located = { zone: x.zone, ...(x.pos ? { pos: { ...x.pos } } : {}) };
      const m = walkLeg(state, x, goal, moveSpeed(state, x).run * seconds, short, x);
      if (m === null || (m <= 0 && x.zone === from.zone)) return;
      if (onLeg) onLeg(x, from, m, goal.zone);
      else if (x.zone !== from.zone) logCode(state, 'caught_up', { actorId: x.id, from: from.zone, to: x.zone }); // a silent jump (BF2)
    };
    if (o.type === 'attack' && t) {
      if (!inReach(state, x, o)) walk(t, CONFIG.HOSTILE_NEAR_M / 2);
      if (!inReach(state, x, o)) continue;
      if (t === p) { reached.push(x.id); continue; }
      fighting = true;
      doAttack(ctx, x, o);
    } else if (o.type === 'move' && o.target) walk({ zone: o.target });
  }
  return { reached, fighting };
}

/** AT56/AT65/AT67: the world clock runs the player's rest, wait, walk (AT45/AT46) or long action (AT45: busy). It steps (comingNear stepS: shorter while someone not
 * yet accepted is in the senses), moving the clock on (natural recovery, aging) and everyone toward their routines
 * (catchUp) each step, and stops at contact, the coming-near check, or a fight in the player's senses. A rest is deep: any
 * stop breaks it, and it heals by the share that ran (AT27); a wait just ends; a walk carries on next turn (AT49); a long
 * action takes effect once its time is done, else waits for the same order again unless its focus is deep. NPCs after someone act on code each step
 * (huntOnCode), and while a fight between them is on the steps are one round. */
type OnLeg = (a: Actor, from: Located, metres: number, toward: string) => void;
function runStretch(ctx: Ctx, st: Stretch, onLeg?: OnLeg): void {
  const { state } = ctx;
  const p = state.player;
  const t0 = now(state);
  const watch = startWatch(state, p, st.pose);
  const fightStop = (): StretchStop | null => (fightInSenses(state) ? { why: 'fight', by: [] } : null);
  // AT45: the one the player is at a long action with (a seller at a trade) talking to them is part of it, not contact
  const partner = st.kind === 'busy' ? st.order?.target : undefined;
  const touched = (events: GameEvent[]): StretchStop | null => { const c = contact(p, events), by = c?.by.filter((id) => id !== partner); return c && by?.length ? { ...c, by } : null; };
  let stop: StretchStop | null = touched(ctx.events) ?? fightStop();
  let ran = 0;
  let fighting = false, walkEnd: 'there' | 'blocked' | null = null, firstS = 0;
  for (let first = true; !stop && ran < st.seconds - T_EPS && isActive(p); first = false) {
    const step = Math.min(stepS(state, watch), fighting ? CONFIG.ROUND_S : Infinity, st.seconds - ran);
    const before = new Map<string, Located>(allActors(state).map((x) => [x.id, { zone: x.zone, ...(x.pos ? { pos: { ...x.pos } } : {}) }]));
    const from = ctx.events.length;
    if (st.walk) { walkEnd = walkStep(ctx, st.walk, step); if (walkEnd) { ran += step; break; } } // AT45: there, or blocked
    passTime(state, step / 60);
    catchUp(state, step / 60, first, onLeg); // the turn's own walks count once
    if (first) { state.scratch!.agentRun = []; firstS = step; } // AT63: an agent's order covers the first step; then everyone runs on code
    const hunt = huntOnCode(ctx, step, onLeg);
    fighting = hunt.fighting;
    headArrivals(state); runSteps(state); // UG16: queued steps run on through a long turn, with no call
    ran += step;
    stop = touched(ctx.events.slice(from)) ?? (hunt.reached.length ? { why: 'contact', by: hunt.reached } : null) ?? checkNear(state, watch, before, step) ?? fightStop();
  }
  (state.scratch ??= {}).caughtUp = ((state.scratch.caughtUp as number | undefined) ?? 0) + (now(state) - t0);
  noteMeanwhile(state, ran - firstS);
  st.ran = ran;
  if (stop) {
    st.stop = stop;
    st.ev.effects.push({ kind: 'stopped', actorId: p.id, data: { why: stop.why, by: stop.by, seconds: Math.round(ran) } });
    logCode(state, 'stretch_stopped', { actorId: p.id, kind: st.kind, why: stop.why, by: stop.by, seconds: Math.round(ran), ...(st.kind === 'busy' && p.busy ? { row: p.busy.row } : {}) });
  }
  if (st.kind === 'walk') {
    if (st.walk && !walkEnd) p.walking = walkOf(st.walk); // AT49: stopped on the way, it carries on next turn
    else delete p.walking;
    if (ran > 0) logCode(state, 'walked_on', { actorId: p.id, seconds: Math.round(ran), arrived: !!st.walk && walkThere(state, p, st.walk) });
  } else if (st.kind === 'busy') {
    const b = p.busy;
    if (b) { const was = b.done; b.done = Math.min(b.need, b.done + ran); payRow(state, p, actionRow(b.row), b.done - was); }
    if (b && b.done >= b.need - T_EPS) { delete p.busy; doMain(ctx, p, st.order!); } // AT45: its time is done: it takes effect
    else if (b && stop && actionRow(b.row)?.focus === 'deep') breakOff(state, p, st.ev); // AT65: deep breaks on any stop; else it waits for the same order again
  } else if (st.kind === 'rest') {
    const share = st.seconds > 0 ? Math.min(1, ran / st.seconds) : 1;
    if (share > 0) {
      const row = restRow(state, p);
      applyHealing(state, p, row, share < 1 ? { share } : {});
      restRecover(state, p, share); // FT7: the line by the share of the hour (and Catnap's sleep debt)
      if (row !== HL.rest) p.paid = p.paid?.filter((x) => x !== row);
      state.clocks[`rest:${p.id}`] = now(state);
      st.ev.effects.push({ kind: 'rested', actorId: p.id, data: share < 1 ? { share: Math.round(share * 100) / 100 } : {} });
    }
  } else if (ran > 0) {
    logCode(state, 'time_passed', { actorId: p.id, minutes: ran / 60, from: t0, to: now(state) });
    st.ev.effects.push({ kind: 'time_passed', actorId: p.id, data: { minutes: ran / 60 } });
  }
}

/** NW18: what a sleeper does on its turn: nothing, asleep */
const asleepOrder = (a: Actor): Order => ({ actorId: a.id, type: 'idle', target: null, skill: null, intent: 'asleep', source: a.kind === 'player' ? 'player' : 'routine', activity: 'sleep' });

/** CS22: an NPC whose routine spot has no path from where it stands logs routine_unreachable once, with the zone it
 * stands in and the zone it can't reach. It logs again only after its routine found a way (a routine walk) or it got
 * there, so a map that strands an NPC leaves one line, not one a turn. */
function noteUnreachable(state: GameState, orders: Map<string, Order>): void {
  for (const [id, o] of orders) {
    const a = actorById(state, id), m = a?.mind;
    if (!a || !m || o.source !== 'routine') continue;
    if (o.intent !== UNREACHABLE) {
      if (m.unreachable && (o.type === 'move' || a.zone === m.unreachable.to)) delete m.unreachable;
      continue;
    }
    const to = desiredState(buildActorView(state, id))?.zone;
    if (!to || (m.unreachable?.from === a.zone && m.unreachable.to === to)) continue;
    m.unreachable = { from: a.zone, to };
    logCode(state, UNREACHABLE, { actorId: id, from: a.zone, to });
  }
}

/** the clock moves on; natural recovery runs for that time (H12–H15) */
function passTime(state: GameState, minutes: number): void {
  advanceAging(state, minutes, (c, d) => logCode(state, c, d)); // AG16
  passiveHealing(state, minutes);
  passiveFatigue(state, minutes); // FT4/FT7/FT28
}

/** NW12/NW15/NW18: the player's night runs on. The clock steps SLEEP_STEP_MIN at a time (to the next change of watch
 * at most): everyone moves on toward their routines (catchUp), sleeps or keeps watch by the plan, and NPCs sleep by
 * their routines. It stops when someone hostile to the player comes near (CS20: their steps reach the player): the clock
 * has moved on only that far, they are there, and each light sleeper they came near may hear them (NW14). The player's sleep heals a rest per
 * REST_COOLDOWN_MIN asleep and counts as the last rest. Returns the minutes it ran. */
function runNight(ctx: Ctx): number {
  const { state, rng } = ctx;
  const p = state.player;
  const n = state.night;
  if (!n) return 0;
  const t0 = now(state);
  const noiseOf = (x: Actor) => armorNoise(state, x, 'move', SENSE.move[0]);
  let present = new Set(hostilesNear(state, p, noiseOf).map((x) => x.id));
  applyNightPhase(state);
  while (now(state) < n.end && !n.woke.includes(p.id) && isActive(p)) {
    const t = now(state);
    const step = Math.max(1, Math.min(CONFIG.SLEEP_STEP_MIN, nextChange(n, t) - t));
    const slept = isAsleep(p);
    passTime(state, step);
    catchUp(state, step, false);
    const reached = huntOnCode(ctx, step * 60).reached; // AT63: foes after the player close in on code; the arrival check below stops the night
    headArrivals(state); runSteps(state); // UG16: queued steps run on through the night, with no call
    if (slept) {
      n.slept += step;
      for (const due = Math.floor(n.slept / CONFIG.REST_COOLDOWN_MIN); n.heals < due; n.heals++) applyHealing(state, p, restRow(state, p));
    }
    applyNightPhase(state);
    settleSleepers(state);
    const here = hostilesNear(state, p, noiseOf);
    // AT42/AT71: a newcomer stops it, and so does a foe after the player that reached them (its blow comes next turn)
    const came = [...new Set([...here.filter((x) => !present.has(x.id)).map((x) => x.id), ...reached])].map((id) => actorById(state, id)!);
    if (came.length) {
      logCode(state, 'sleep_stopped', { actorId: p.id, by: came.map((x) => x.id) });
      (state.scratch ??= {}).nightStopped = true; // the next turn starts with them there
      for (const s of allActors(state).filter(isAsleep)) for (const x of hostilesNear(state, s, noiseOf).filter((h) => came.includes(h))) if (wakeCheck(state, s, x, noiseOf(x), rng)) break;
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
  noteMeanwhile(state, minutes * 60);
  return minutes;
}

/** AT63: time ran on past the agents' orders (a stretch or a night): each agent-run NPC's next Planner call is told how long */
function noteMeanwhile(state: GameState, seconds: number): void {
  if (seconds <= T_EPS) return;
  for (const x of state.actors) if (x.mind?.control === 'agent' && isActive(x)) x.mind.meanwhile = { turn: state.turn, seconds: (x.mind.meanwhile?.turn === state.turn ? x.mind.meanwhile.seconds : 0) + seconds };
}

/** T1: a fight turn (turnSeconds), else the Action times row naming the order type, else the default action row (DU) */
function turnMinutes(state: GameState, o: Order): number {
  const rows = getLibrary().durations ?? {};
  if (state.mode === 'tactical') return turnSeconds(state, o) / 60;
  const base = (Object.values(rows).find((d) => d.orders?.includes(o.type)) ?? rows[DU.action])?.seconds ?? 0;
  return Math.max(base, orderCost(state, state.player, o)?.seconds ?? 0) / 60; // AT13: never shorter than the order's own action
}
/** AT13/AT46: outside a fight a turn lasts as long as the player's order, up to EXPLORE_TURN_S: its walk, its way and gear
 * ops and its action's seconds. An action with no time of its own (a hold, an untimed action), or a turn with nothing
 * timed in it, lasts the default action row. Longer actions run on the world clock instead (AT45, runStretch). */
function exploreSeconds(ctx: Ctx, o: Order): number {
  const p = ctx.state.player, own = ctx.own ?? { over: 0, fill: 0 };
  const timed = Math.max(slotsOf(ctx, p).walkedS, (ctx.clock.get(p.id) ?? 0) - own.fill) + own.over;
  const plainMove = o.type === 'move' || o.type === 'flee' || (o.type === 'hold' && !!o.move); // BG-16: just the walk
  const untimed = timed <= T_EPS || (own.fill > T_EPS && !plainMove);
  return Math.min(CONFIG.EXPLORE_TURN_S, untimed ? Math.max(timed, actionRow(DU.action)?.seconds ?? 0) : timed);
}
/** AT13/AT78: a fight turn lasts FIGHT_TURN_S, or as long as the player's order when that is one shorter action with no walk
 * (never under FIGHT_TURN_MIN_S); an attack repeats to fill it */
function turnSeconds(state: GameState, o: Order): number {
  const c = o.type === 'attack' || o.type === 'hold' || o.move ? undefined : orderCost(state, state.player, o);
  return c ? Math.min(CONFIG.FIGHT_TURN_S, Math.max(CONFIG.FIGHT_TURN_MIN_S, c.seconds)) : CONFIG.FIGHT_TURN_S;
}

/** H2/H3: using a carried item that names a healing source applies that row and uses one up; works in a fight only
 * if the row allows it. Returns false when the item doesn't heal, so the order resolves as before. */
function doHealItem(ctx: Ctx, a: Actor, o: Order): boolean {
  const { state } = ctx;
  const inst = a.core.inventory.find((i) => i.id === o.item || i.itemId === o.item);
  const def = inst ? itemDef(state, inst.itemId) : undefined;
  const row = def?.heal ? getLibrary().healing?.[def.heal] : undefined;
  if (!inst || !row) return false;
  // BF13: used on someone else, it heals them by the same row, if they are within the user's grip reach (closed in on: NEEDS)
  const t = (o.target && actorById(state, o.target)) || a;
  if (t !== a && !withinGrip(state, a, t)) { emit(ctx, bark(mk(ctx, a, 'wasted', { target: t.id, itemId: inst.itemId, reason: 'out_of_reach' }), o)); return true; }
  const ev = bark(mk(ctx, a, 'use_item', { itemId: inst.itemId, ...(t !== a ? { target: t.id } : {}) }), o);
  if (!wouldHeal(state, t, row.id)) {
    logCode(state, 'heal_blocked', { actorId: a.id, source: row.id, reason: 'nothing_to_heal', ...(t !== a ? { target: t.id } : {}) });
  } else {
    applyHealing(state, t, row.id);
    t.core.condition.tended = { turn: state.turn, by: a.id, itemId: inst.itemId }; // BG-181: the binding shows
    inst.qty = (inst.qty ?? 1) - 1;
    if (inst.qty <= 0) a.core.inventory.splice(a.core.inventory.indexOf(inst), 1);
    ev.effects.push({ kind: 'healed', actorId: t.id, data: { source: row.id } });
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
    // Q17/SE15: looking is a sight (or hearing) roll with light only, no scene number; Success or better shows everyone in sight clearly
    const target = CONFIG.DIFFICULTY.moderate; // it learns like a solo roll at Moderate
    const modifiers = [
      ...situational(state, fnRoller(state, a, noticeCue(o.skill) === 'sound' ? FN.hearing : FN.sight), { light: zoneById(state, a.zone), actor: a }).modifiers, // ST21: light by the rolling skill's tags (Q3)
    ];
    const fn = noticeCue(o.skill) === 'sound' ? FN.hearing : FN.sight;
    const r = ruleset.roll({ actorId: a.id, skill: o.skill, modifiers, tierShifts: [], fn }, state, rng); // function roll
    ev.roll = r;
    ev.tier = r.tier;
    if (tierAtLeast(r.tier, 'success')) lookAround(state);
    ev.effects.push(...foundEffects(a, searchFor(state, a, ev, rng, { look: fn }))); // SE14: also a weak search
    ruleset.recordUse(a, r.skill, { actorId: a.id, skill: r.skill, target, passed: tierAtLeast(r.tier, 'success'), modifiers }, state);
  } else if (o.skill && CHECK_TYPES.has(o.type)) {
    result = ruleset.check({ actorId: a.id, skill: o.skill, target: o.target ?? undefined, modifiers: [] }, state, rng);
    ev.check = result;
    ev.effects = ruleset.applyEffects(result, state);
    ruleset.recordUse(a, result.skill, result, state);
  }
  emit(ctx, ev, result);
}

const foundEffects = (a: Actor, won: { found: Actor }[]): Effect[] => won.map(({ found }) => ({ kind: 'found', actorId: found.id, data: { by: a.id } }));
/** SE1/SE3/SE6/SE16/SE19: a search is the main action, the same for everyone: a contest against everyone hiding in reach
 * (searchFor), or against the one person named. With nothing hidden nothing is rolled, a lost roll reads the same as an
 * empty spot, and the dice show only with a find (SE6). */
function doSearch(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const ev = bark(withActivity(ctx, a, mk(ctx, a, 'search', { target: o.target ?? undefined }), o.activity), o);
  const t = o.target ? actorById(state, o.target) : undefined;
  const logAt = state.log.length;
  const won = searchFor(state, a, ev, rng, t ? { only: t.id } : {});
  const tied = state.log.slice(logAt).some((l) => l.code === 'search_contest' && l.detail?.gap === 0); // a 'someone' half found
  if (won.length) ev.contest = won[0].r;
  ev.effects.push(...foundEffects(a, won));
  // SE8/SE11: hidden things: on a person seen, their gear; else the ground in reach
  const items = t ? (atLeast(beliefStatus(state, a, t), 'aware') ? { ...searchPerson(state, a, t, rng), hint: false } : { found: [], hint: false }) : searchItems(state, a, rng);
  if (items.found.length) {
    if (items.r) ev.roll = items.r;
    ev.effects.push({ kind: 'found_items', actorId: t?.id ?? a.id, data: { by: a.id, items: items.found.map((i) => i.id), ...(t ? { on: true } : {}) } });
  }
  if (items.hint) ev.effects.push({ kind: 'disturbed', actorId: a.id, data: {} });
  // SE17: a person searched may give up a secret a sight or hearing roll can reveal
  const secrets = t && atLeast(beliefStatus(state, a, t), 'aware') ? searchSecrets(state, a, t, rng) : { found: [] };
  if (secrets.found.length) {
    ev.roll ??= secrets.r;
    ev.effects.push({ kind: 'found_secret', actorId: t!.id, data: { by: a.id, secrets: secrets.found } });
  }
  // BG-142: a search always ends in an outcome; nothing found reads the same whether nothing was there or it was missed (SE6)
  if (!ev.effects.length && !tied) ev.effects.push({ kind: 'found_nothing', actorId: t?.id ?? a.id, data: { by: a.id, ...(t ? { on: true, held: gripOn(state, a, t) } : {}) } });
  emit(ctx, ev);
}

/** SE9: stashing a carried item is the main action: a stealth function roll (light, cover and the hide tag as for a
 * hide) whose tier becomes the item's hidden-at tier; it lies where the stasher stands. Whoever sees the stash clearly
 * knows where it is. */
function doStash(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const inst = a.core.inventory.find((i) => i.id === o.item);
  if (!inst || inst.soulbound) return emit(ctx, bark(mk(ctx, a, 'wasted', { reason: 'no_item' }), o)); // HF18: soulbound gear can't be put down
  const z = zoneById(state, a.zone), skill = fnRoller(state, a, FN.stealth);
  const r = ruleset.roll({ actorId: a.id, skill, ...situational(state, skill, { light: z, cover: z, add: ['hide'], actor: a }), fn: FN.stealth, rollKind: 'stealth' }, state, rng);
  dropToGround(state, a, inst.id, a.zone);
  inst.hiddenAt = { tier: r.tier, ...(r.beyond ? { beyond: r.beyond } : {}) };
  inst.knownTo = [a.id];
  inst.hiderSkill = trueSkill(a, r.skill); // SE25 a: a search learns against this
  const ev = bark(mk(ctx, a, 'stash', { itemId: inst.id, roll: r, tier: r.tier }), o);
  emit(ctx, ev);
  const watchers = Object.entries(ev.perception).filter(([id, p]) => p.level === 'full' && p.cue === 'sight' && id !== a.id).map(([id]) => actorById(state, id)).filter((w): w is Actor => !!w);
  for (const w of watchers) if (!inst.knownTo.includes(w.id)) inst.knownTo.push(w.id);
  // SE25 a: a stash learns against the best sight skill watching it; unwatched, it learns nothing
  if (watchers.length) markAgainst(state, a, r, Math.max(...watchers.map((w) => trueSkill(w, fnRoller(state, w, FN.sight)))));
}

/** the barrier on the way from `a`'s zone to `to`, and that link */
const barrierTo = (state: GameState, a: Actor, to: string | null | undefined): Barrier | undefined =>
  to ? barrierOn(state, zoneById(state, a.zone)?.links.find((l) => l.to === to)) : undefined;

/** BG-144: why a way op came to nothing, in the words a wasted event carries */
const WAY_DROP_WORDS: Record<string, string> = { no_move: 'no_time_left', no_barrier: 'nothing_to_work', no_bar: 'nothing_to_work', no_lock: 'nothing_to_work', already: 'already_done', far_side: 'from_the_wrong_side', no_key: 'no_key' };

/** BA3/BA4: a key turned or a bar slid on purpose, in the move slot (o.way); it stands in for the turn's move. `mainToo`:
 * with the move slot gone on the walk to the door (BG-86), the free main action does it */
function doWayOp(ctx: Ctx, a: Actor, w: NonNullable<Order['way']>, mainToo = false): boolean {
  const { state } = ctx;
  const b = barrierTo(state, a, w.toZone);
  // BG-54: try it on a copy first, so an op that can't be done spends no move slot
  const dry = b && { ...b, ...(b.lock ? { lock: { ...b.lock } } : {}), ...(b.bar ? { bar: { ...b.bar } } : {}) };
  const dryWhy = !b || !dry ? 'no_barrier' : wayOp(dry, a, a.zone, w.op);
  // BG-70: opening a way shut to them is trying it: the move slot goes on it and they learn why it won't open
  if (dryWhy === 'shut' && b && useWayTime(ctx, a, w.op, mainToo)) {
    noteTried(b, a);
    emit(ctx, mk(ctx, a, 'way', { target: w.toZone, way: { to: w.toZone, barrier: b.id, did: `found_${shutBy(b, a, a.zone)}` as WayDid } }));
    return true;
  }
  const why = dryWhy ?? (!useWayTime(ctx, a, w.op, mainToo) ? 'no_move' : wayOp(b!, a, a.zone, w.op));
  if (why || !b) {
    logCode(state, 'way_op_dropped', { actorId: a.id, to: w.toZone, op: w.op, reason: why });
    emit(ctx, mk(ctx, a, 'wasted', { target: w.toZone, reason: WAY_DROP_WORDS[why ?? ''] ?? why ?? 'nothing_to_work' })); // BG-144: told, not silent
    return false;
  }
  emit(ctx, mk(ctx, a, 'way', { target: w.toZone, way: { to: w.toZone, barrier: b.id, did: w.op } }));
  return true;
}

/** BA2: picking the lock on the way to o.target: a Lockpicking function roll (the Lockpicking skill, Filching standing in at 0.3; lockpicks help) at the lock's
 * grade. Success opens it once the picking time is done: out of a fight that time passes at once; in a fight each turn at
 * it adds a fight turn of work (busy until it opens). Near Miss: not yet, keep going. Failure: beyond the picker until its
 * skill or tools get better. Critical Failure: the pick snaps (the lockpicks used are lost). Quiet: a whisper. */
function doPick(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  // CT3: a container's lock is picked the same way, at the container's grade; an owner watching over it makes it theft
  const c = findContainer(state, o.target);
  if (c) c.inst.grade ??= 'minor';
  const b = (c?.inst ?? barrierTo(state, a, o.target)) as Pick<Barrier, 'id' | 'grade' | 'lock' | 'beyond' | 'work'> | undefined;
  if (!b?.lock?.locked) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: b?.lock ? 'not_locked' : 'no_lock' }), o));
  if (c ? !withinGrip(state, a, c.at) : !atDoor(state, a, o.target)) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: 'out_of_reach' }), o)); // BG-86
  const to = o.target!;
  // CT4: picking the lock of a container its owner guards is filching: caught or fumbled, the picking stops there
  if (c && theft(state, a, c) && !filchStep(ctx, a, o, ownerOf(state, c), c.at, c.inst)) return;
  const way = (did: WayDid, extra: Partial<GameEvent> = {}) => bark(mk(ctx, a, 'pick', { target: to, way: { to, ...(c ? {} : { barrier: b.id }), did }, ...(c ? { itemId: to } : {}), ...extra }), o);
  const skill = fnRoller(state, a, FN.lockpicking);
  const tool = pickTool(state, a, skill).itemId ?? undefined;
  const eff = effectiveSkill(state, a, FN.lockpicking, { itemId: tool, fullValue: rollFnSkills(a, FN.lockpicking) }).value; // FL1: Filching stands in at its share
  if (b.beyond?.[a.id] !== undefined && eff <= b.beyond[a.id]) return emit(ctx, way('beyond'));
  const modifiers: Mod[] = CONFIG.LOCK_GRADE_MOD[b.grade] ? [{ source: 'lock', type: 'situational', value: CONFIG.LOCK_GRADE_MOD[b.grade] }] : [];
  const r = ruleset.roll({ actorId: a.id, skill: FN.lockpicking, modifiers, tierShifts: [], fn: FN.lockpicking, ...(tool ? { itemId: tool } : {}) }, state, rng);
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
    const work = ((b.work ??= {})[a.id] = (b.work[a.id] ?? 0) + ctx.turnS);
    payRow(state, a, actionRow(DU.pick_lock), ctx.turnS); // FT24: picking has no order row of its own, so it pays here
    if (work < need || !tierAtLeast(r.tier, 'success')) return emit(ctx, way(tierAtLeast(r.tier, 'success') ? 'picking' : 'not_yet', extra));
  } else {
    payRow(state, a, actionRow(DU.pick_lock), need);
    const extraMin = need / 60 - turnMinutes(state, o);
    if (extraMin > 0) { passTime(state, extraMin); logCode(state, 'time_passed', { actorId: a.id, minutes: extraMin, picking: true }); }
    if (!tierAtLeast(r.tier, 'success')) return emit(ctx, way('not_yet', extra));
  }
  b.lock.locked = false;
  delete b.work?.[a.id];
  emit(ctx, way('picked', extra));
}

/** CT3: opening a container within grip reach is the turn's action: it stands open and its contents show. Locked, the
 * key turns if they carry it (else they find it locked). CT4: one its owner guards is opened by filching: a Filching
 * contest against everyone who could notice (src/engine/filch.ts); caught or fumbled, it stays shut. CT5: a worn pack
 * its wearer guards is never opened (theft): a hand goes into it by filching. */
function doOpen(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  const c = findContainer(state, o.target);
  // CT5: a pack its wearer guards is never opened, only reached into (filch)
  if (c && withinGrip(state, a, c.at) && theft(state, a, c) && !(c.holder && wornPack(c.inst)) && !filchStep(ctx, a, o, ownerOf(state, c), c.at, c.inst)) return;
  const why = !c ? 'no_container' : !withinGrip(state, a, c.at) ? 'out_of_reach' : openContainer(state, a, c, !(c.holder && wornPack(c.inst)));
  emit(ctx, bark(mk(ctx, a, why ? 'wasted' : 'open', { target: o.target ?? undefined, ...(c ? { itemId: c.inst.id } : {}), ...(why ? { reason: why } : {}) }), o));
}

/** BF31: breaking a locked container open, within grip reach: the turn's action, loud (heard like a shout). A soft one (a
 * sack, a pack) is cut open by an edged weapon in hand, with no roll. Otherwise a roll of the melee weapon in hand (bare
 * hands: Improvised) at the lock's grade, the same modifier Lockpicking uses; Success or better opens it, and its lock is
 * broken for good. BK1-BK4: the same roll is checked against everything inside (src/engine/breakage.ts), opened or not, and
 * a rolled open counts toward the broke_open chain. BK6: one someone guards is open theft (theftSeen). */
function doBreak(ctx: Ctx, a: Actor, o: Order): void {
  const { state, rng } = ctx;
  const c = findContainer(state, o.target);
  const why = !c ? 'no_container' : !withinGrip(state, a, c.at) ? 'out_of_reach' : c.inst.open ? 'already_open' : !c.inst.lock?.locked ? 'not_locked' : null;
  if (why || !c) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, ...(c ? { itemId: c.inst.id } : {}), reason: why ?? 'no_container' }), o));
  const owner = theft(state, a, c) ? ownerOf(state, c) : undefined;
  const done = (ev: GameEvent) => { emit(ctx, bark(ev, o)); if (owner) theftSeen(state, a, owner, itemDef(state, c.inst.itemId).name, ev); };
  const ev = (opened: boolean, extra: Partial<GameEvent> = {}) => mk(ctx, a, 'break_open', { target: c.inst.id, itemId: c.inst.id, breakOpen: { opened }, ...extra });
  const held = usableModes(state, a).find((m) => m.mode.tree === 'melee' && !m.itemId.startsWith('natural:'));
  const blade = held && itemDef(state, a.core.inventory.find((i) => i.id === held.itemId)?.itemId ?? '').edge;
  const open = () => { c.inst.lock = { locked: false, broken: true }; c.inst.open = true; };
  if (blade && itemDef(state, c.inst.itemId).container?.soft) { open(); return done(ev(true, { breakOpen: { opened: true, cut: true } })); }
  c.inst.grade ??= 'minor';
  const skill = held ? modeSkill(held.mode) : SK.unarmed_improvised;
  const modifiers: Mod[] = CONFIG.LOCK_GRADE_MOD[c.inst.grade] ? [{ source: 'lock', type: 'situational', value: CONFIG.LOCK_GRADE_MOD[c.inst.grade] }] : [];
  const r = ruleset.roll({ actorId: a.id, skill, modifiers, tierShifts: [], ...(held ? { itemId: held.itemId } : {}) }, state, rng);
  const opened = tierAtLeast(r.tier, 'success');
  ruleset.recordUse(a, r.skill, { actorId: a.id, skill: r.skill, target: CONFIG.DIFFICULTY[c.inst.grade] ?? CONFIG.DIFFICULTY.moderate, passed: opened, modifiers }, state);
  const broke = breakInside(state, a, contentsOf(c), r);
  if (opened) open();
  if (opened && a === state.player) tally(state, 'broke_open');
  done(ev(opened, { roll: r, tier: r.tier, breakOpen: { opened, ...(broke.length ? { broke: broke.map((i) => i.id) } : {}) } }));
}

/** BK6: a container its owner guards forced open is theft seen, with no Filching contest: everyone outside the breaker's
 * band who made it out clearly caught them, as caught Filching (FL5); one who only half perceived it is suspicious. Those
 * who did not know the breaker was there perceive it too (as detection reads it): the noise is what tells them. */
function theftSeen(state: GameState, a: Actor, owner: Actor, what: string, ev: GameEvent): void {
  const caught: Actor[] = [], suspicious: Actor[] = [];
  for (const w of allActors(state)) {
    if (w === a || w.bandId === a.bandId || (!w.mind && w.kind !== 'player') || !isActive(w) || isAsleep(w)) continue;
    const level = ev.perception[w.id]?.level ?? perceptionOf(ev, state, w)?.level;
    if (level) (level === 'full' ? caught : suspicious).push(w);
  }
  if (caught.length || suspicious.length) filchAftermath(state, a, owner, what, { outcome: caught.length ? 'caught' : 'fumbled', caught, suspicious });
}

/** CT4/FL4: a guarded container opened or picked under watch: the Filching contest, with the container's size. Caught or
 * fumbled: the filch event says so and the try stops (false); unnoticed: it goes on (true). */
function filchStep(ctx: Ctx, a: Actor, o: Order, owner: Actor | undefined, at: Located, inst: ItemInstance): boolean {
  const f = filchContest(ctx.state, a, owner, at, 0, ctx.rng, recentAround(ctx));
  if (f.outcome === 'taken') return true;
  filchAftermath(ctx.state, a, owner, itemDef(ctx.state, inst.itemId).name, f);
  emitFilch(ctx, a, o, owner, inst, f);
  return false;
}
const recentAround = (ctx: Ctx): GameEvent[] => [...(ctx.state.recentEvents ?? []), ...ctx.state.events, ...ctx.events];
function emitFilch(ctx: Ctx, a: Actor, o: Order, owner: Actor | undefined, inst: ItemInstance, f: Filched, qty?: number): void {
  const ev = mk(ctx, a, 'filch', { ...(owner ? { target: owner.id } : {}), itemId: inst.id, ...(qty ? { qty } : {}), tier: f.roll.tier, roll: f.roll, filch: f.outcome });
  ev.noise = f.noise;
  ev.visibility = CONFIG.FILCH_VISIBILITY;
  ev.perception = f.perception;
  emit(ctx, bark(ev, o), undefined, true);
}

/** FL1–FL7: filching one item from someone (o.target an actor) or an owned container (o.target the container), o.item
 * the item (an instance id, or a library id for the first of that kind; null: whatever comes to hand). Within grip
 * reach, not held or worn, no bigger than FILCH_MAX_BULK. From someone down, yielded or not watching over it, it is just
 * taken; otherwise the Filching contest decides (src/engine/filch.ts). */
function doFilch(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  const wasted = (reason: string) => emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, ...(o.item ? { itemId: o.item } : {}), reason }), o));
  const t = o.target ? actorById(state, o.target) : allActors(state).find((x) => x !== a && x.core.inventory.some((i) => i.id === o.item));
  const c = t ? null : findContainer(state, o.target);
  const holder = t ?? (c?.holder && wornPack(c.inst) ? c.holder : undefined);
  if ((!t && !c) || t === a) return wasted('no_one_to_filch_from');
  const at: Located = t ?? c!.at, owner = t ?? ownerOf(state, c!);
  const list = holder ? holder.core.inventory : c!.inst.contents ?? (c!.inst.contents = []);
  const pool = holder ? filchable(state, holder) : contentsOf(c!).filter((i) => filchSize(itemDef(state, i.itemId).bulk) !== null);
  const want = o.item?.replace(/^goods:/, '');
  const named = want ? list.find((i) => i.id === want) ?? list.find((i) => i.itemId === want && pool.includes(i)) ?? list.find((i) => i.itemId === want) : undefined;
  if (want && !named) return wasted('no_item');
  if (named && named.equippedIn?.length) return wasted('worn');
  if (named?.soulbound) return wasted('soulbound'); // HF18: an echo's gear can't be taken
  if (named && !pool.includes(named)) return wasted('too_big');
  if (!pool.length) return wasted('nothing_to_filch');
  if (!withinGrip(state, a, at)) return wasted('out_of_reach');
  const inst = named ?? pool[ctx.rng.int(0, pool.length - 1)];
  const watched = guarded(state, a, owner);
  const f = watched ? filchContest(state, a, owner, at, itemDef(state, inst.itemId).bulk, ctx.rng, recentAround(ctx)) : null;
  if (f && f.outcome !== 'taken') {
    filchAftermath(state, a, owner, itemDef(state, inst.itemId).name, f);
    return emitFilch(ctx, a, o, owner, inst, f);
  }
  const before = inst.qty;
  const got = takeFilched(state, a, list, inst, watched ? owner?.id : undefined);
  if (!f) return emit(ctx, bark(mk(ctx, a, 'filch', { ...(owner ? { target: owner.id } : {}), itemId: got.id, ...(got.qty ? { qty: got.qty } : {}), filch: 'taken' }), o));
  emitFilch(ctx, a, o, owner, got, f, before !== undefined ? got.qty : undefined);
}

/** BF16: turning out your own pockets: what you carry (not worn or held) and what your carried sacks and packs hold shows to
 * everyone who sees it clearly; o.item, one thing you try to keep back, stays hidden only if the Filching contest is
 * unnoticed by all (src/engine/filch.ts) */
function doShow(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  const carried = a.core.inventory.filter((i) => !isHeld(i) && !i.soulbound);
  const shown = carried.flatMap((i) => [...(i.equippedIn?.length ? [] : [i]), ...(i.contents ?? [])]);
  const keep = o.item ? shown.find((i) => i.id === o.item || i.itemId === o.item) : undefined;
  const f = keep ? filchContest(state, a, undefined, a, itemDef(state, keep.itemId).bulk, ctx.rng, recentAround(ctx)) : null;
  const palmed = f?.outcome === 'taken' ? keep : undefined;
  const items = shown.filter((i) => i !== palmed);
  const ev = mk(ctx, a, 'show', { ...(f ? { roll: f.roll, tier: f.roll.tier } : {}) });
  ev.effects.push({ kind: 'shown_items', actorId: a.id, data: { items: items.map((i) => i.id), ...(keep && !palmed ? { palmFailed: true } : {}) } });
  emit(ctx, bark(ev, o));
  for (const [id, p] of Object.entries(ev.perception)) {
    const w = actorById(state, id);
    if (w && w !== a && p.level === 'full') revealItems(state, w, a, items);
  }
}

function doMain(ctx: Ctx, a: Actor, o: Order): void {
  const { state } = ctx;
  switch (o.type) {
    case 'move':
    case 'flee':
      // a move as the main action walks one slot's worth toward the zone
      if (!o.target || o.target === a.zone) return hold(ctx, a, o);
      if (!walk(ctx, a, { zone: o.target }, o, (n) => (n === 0 ? { paid: 'move', seconds: ctx.turnS, pool: 'none' } : null), { bark: true })) return dropped(ctx, a, o);
      return;
    case 'attack':
      return doAttack(ctx, a, o);
    case 'rest':
      return doRest(ctx, a, o);
    case 'pick':
      return doPick(ctx, a, o);
    case 'filch':
      return doFilch(ctx, a, o);
    case 'show':
      return doShow(ctx, a, o);
    case 'steady': { // SY1: steadying yourself (engine/steady.ts); a loss goes through fear(), which applies a break
      const why = cantSteady(state, a);
      if (why) return emit(ctx, bark(mk(ctx, a, 'wasted', { reason: why }), o));
      const ev = mk(ctx, a, 'steady', {});
      emit(ctx, bark(ev, o));
      const r = steady(state, a, ctx.rng, (cost) => fear(ctx, a, FR.steady_slipped, { cost }));
      Object.assign(ev, { tier: r.roll.tier, roll: r.roll, steady: { points: Math.round(r.points), ...(r.buff ? { buff: true } : {}) } });
      return;
    }
    case 'search':
      return doSearch(ctx, a, o);
    case 'stash':
      return doStash(ctx, a, o);
    case 'open':
      return doOpen(ctx, a, o);
    case 'break':
      return doBreak(ctx, a, o);
    case 'restrain': {
      // BF5: a grab to hold someone back, within the grabber's grip reach; no damage, no hostility
      const t = o.target ? actorById(state, o.target) : undefined;
      const why = !t || t === a ? 'no_target' : !isActive(t) ? 'already_down' : !withinGrip(state, a, t) ? 'out_of_reach' : t.heldBy === a.id ? 'already_holding' : null;
      if (why) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: why }), o));
      return emit(ctx, bark(mk(ctx, a, 'restrain', { target: t!.id, effects: [restrain(state, a, t!, ctx.rng).effect] }), o));
    }
    case 'hide':
      // ST3/NS2: a hide is a stealth contest per observer (stealthDetect)
      return emit(ctx, bark(mk(ctx, a, 'hide', o.vanish ? { vanish: true } : {}), o));
    case 'wait':
    case 'sleep':
      return doWait(ctx, a, o);
    case 'give': {
      const got = giveItem(state, a, o.item, o.target, o.qty) ?? (stepUpToTake(ctx, a, o) ? giveItem(state, a, o.item, o.target, o.qty) : null);
      if (!got) { // BG-149: a wasted event always says why
        const t = o.target ? actorById(state, o.target) : undefined;
        const why = !t || t === a ? 'no_one_to_give_to' : !isActive(t) ? 'already_down' : !a.core.inventory.some((x) => x.id === o.item) ? 'no_item' : !withinGrip(state, a, t, gripReachM(state, t)) ? 'out_of_reach' : 'not_that_many';
        return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: why }), o));
      }
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
      if (!equipArmor(state, a, o.item)) return emit(ctx, bark(mk(ctx, a, 'wasted', { reason: 'cannot_put_that_on' }), o)); // BG-149
      return emit(ctx, bark(mk(ctx, a, 'equip', { itemId: o.item ?? undefined }), o));
    }
    case 'use_item':
      if (doHealItem(ctx, a, o)) return;
      // BG-171: using an item one does not carry (or none named) comes to nothing, and says why
      if (!a.core.inventory.some((i) => i.id === o.item || i.itemId === o.item)) return emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: 'no_item' }), o));
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
  const gearNow = (o.gear ?? []).filter((op) => !later.includes(op));
  const pack = packOps(state, a, gearNow); // PO2: read before the ops move anything
  const g = applyGearOps(state, a, gearNow);
  useGearTime(ctx, a, gearNow.filter((op) => !g.invalid.includes(op)), pack);
  for (const p of g.picked) emit(ctx, mk(ctx, a, 'pick_up', { itemId: p.itemId, target: p.from }));
  for (const id of g.summoned) emit(ctx, mk(ctx, a, 'summon', { itemId: id })); // TB6
  for (const d of g.setDown) emit(ctx, mk(ctx, a, 'set_down', { itemId: d.itemId, ...(d.qty ? { qty: d.qty } : {}) })); // OA4
  for (const d of g.putIn) emit(ctx, mk(ctx, a, 'put_in', { itemId: d.itemId, into: d.into, ...(d.qty ? { qty: d.qty } : {}) })); // PI1
  if (g.invalid.length) logCode(state, 'invalid_gear', { actorId: id, ops: g.invalid });
  // TV1: a move along a road with nothing else going on is a trip, walked in one turn
  const trip = tripGoal(state, a, o);
  if (trip) { if (a === state.player) ctx.travelled = true; return doTravel(ctx, a, o, trip); }
  // AE1/ZP3/AT19: a shot or a throw that locks movement takes its seconds of move time too. One that reaches from here takes
  // that move time first, and the move goes only on what is left; one that doesn't is dropped and the move stands
  let cost = orderCost(state, a, o);
  let lockPaid = false;
  if (o.type === 'attack' && rangedHere(state, a, o)) {
    if (inReach(state, a, o)) {
      const s = slotsOf(ctx, a);
      if (cost?.row.locksMove) { s.move = Math.max(0, s.move - cost.seconds); lockPaid = true; }
      if (o.move && s.move <= T_EPS) { logCode(state, 'move_dropped', { actorId: id, to: o.move, reason: 'ranged_attack' }); o.move = null; }
    } else if (o.move) { logCode(state, 'order_dropped', { actorId: id, type: o.type, target: o.target, reason: 'ranged_after_move' }); o.type = 'hold'; o.target = null; }
  }
  // ZP3 closing in: a melee attack on someone out of reach, with no other move planned before the blow, walks at them on
  // the move slot first and stops once in reach; still out of reach, the blow is lost (doAttack wastes it)
  // FR4: the same for every action that needs grip or weapon reach (NEEDS), and for a door worked on purpose (BG-86)
  const near = reachOf(state, a, o);
  const over = !!near && o.move === a.zone && o.moveSpot?.near === near.at.zone; // BG-183: approachMove's walk to the counter is the close-in
  const closeIn = !!near && !o.moveAfter && (!!o.way || !o.move || o.move === near.at.zone || over);
  const behind = !o.way && !!near && o.move === near.at.zone && near.at.zone !== a.zone; // BG-183: a move into their zone is a move behind the counter (approachMove)
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
  const closer = () => { if (closeIn && !near!.ok()) closeInOn(ctx, a, o, near!, behind); };
  // BA3/BA4: the key or the bar takes the move slot; BG-54: a way op that can't be done leaves the move to happen.
  // BG-86: out of reach of the door, the move slot walks to it, and the op takes the main action if that is free
  let turned = false;
  if (o.way) {
    const walked = closeIn && !near!.ok();
    const was = a.pos && { zone: a.zone, pos: { ...a.pos } }, moveLeft = slotsOf(ctx, a).move;
    closer();
    // BG-172: a step up to the way (a step at most) is part of working it, so the op still has the move time
    if (walked && was && near?.ok() && distM(state, a, was) <= CONFIG.ENTER_M) slotsOf(ctx, a).move = moveLeft;
    if (near?.ok()) turned = doWayOp(ctx, a, o.way, o.type === 'hold'); // BG-165: a way not out of this zone (null) is out of reach too
    else { // BG-144: the walk did not reach the way, so the op comes to nothing this turn, and the story says why
      logCode(state, 'way_op_dropped', { actorId: id, to: o.way.toZone, op: o.way.op, reason: 'out_of_reach' });
      emit(ctx, mk(ctx, a, 'wasted', { target: o.way.toZone, reason: 'out_of_reach' }));
    }
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
  const moved = a.zone !== from.zone || (!!a.pos && !!from.pos && distM(state, a, { zone: a.zone, pos: from.pos }) > M_EPS);
  // AT48: the main action finishes after the walk that led to it and the gear ops before it
  const pools = slotsOf(ctx, a);
  if (!o.moveAfter) ctx.clock.set(id, Math.max(ctx.clock.get(id) ?? 0, pools.walkedS));
  // FT10: Spent, an action above Light comes to nothing (picking pays at the lock's row)
  if (!ctx.spoke.has(id) && tooSpent(a, o.type === 'pick' ? actionRow(DU.pick_lock)?.effort : cost?.row.effort)) {
    logCode(state, 'spent_no_action', { actorId: id, type: o.type });
    emit(ctx, bark(mk(ctx, a, 'wasted', { target: o.target ?? undefined, reason: 'spent' }), o));
    if (o.moveAfter && !turned) move(false);
    return;
  }
  // AT2/AT17: an action longer than the turn goes on over turns; one that ends this turn spends only what is left of it
  if (a.busy && (!cost || ctx.spoke.has(id))) setAside(state, a);
  if (cost && !ctx.spoke.has(id)) {
    const long = longAction(ctx, a, o, cost);
    if (long === 'busy') { if (o.moveAfter && !turned) move(false); return; }
    cost = long;
  }
  ctx.at = (ctx.clock.get(id) ?? 0) + Math.min(cost?.seconds ?? pools.main, pools.main);
  if (!ctx.spoke.has(id) && useMain(ctx, a, cost && { ...cost, lockPaid }) && !(o.type === 'hold' && moved && !o.line)) doMain(ctx, a, o);
  if (o.moveAfter && !turned) move(false); // AE3: act, then move
}

/** main time an actor can still spend this turn: what is left in the pool, and no further than the turn's end (a walk
 * before the action pushes its clock on) */
function mainLeft(ctx: Ctx, a: Actor): number {
  const s = slotsOf(ctx, a);
  return Math.max(0, Math.min(s.main, ctx.turnS + s.carried.main - (ctx.clock.get(a.id) ?? 0)));
}

/** AT2/AT17: what makes a long action the same one again: its row, and for anything but an attack its item and target (a
 * crossbow's spanning goes on whoever it is aimed at) */
const busyKey = (row: DurationDef, o: Order): string => (o.type === 'attack' ? row.id : `${row.id}|${o.item ?? ''}|${o.target ?? ''}`);
/** AT6/AT28: what is left of a long action broken off (or set aside) at this progress; lost when the row names nothing */
const breakBand = (b: NonNullable<Actor['busy']>): string => actionRow(b.row)?.onBreak?.find((x) => b.done / b.need <= x.upTo + T_EPS)?.then ?? 'lost';
/** AT47: the order that carries a long action on */
const busyOrder = (a: Actor): Order => ({ actorId: a.id, type: a.busy!.order.type, target: a.busy!.order.target, item: a.busy!.order.item, skill: null, intent: 'busy', source: 'routine' });

/** AT2/AT17/AT45: an action longer than a whole fight turn's time is a long action: it goes on turn after turn (the actor
 * busy) and takes effect when its seconds are done. Returns the seconds still to spend when it finishes this turn (or the
 * cost unchanged for a short action), or 'busy' when it took all the time left and goes on. Outside a fight a turn lasts
 * the whole action, so only work kept from before counts. Another order sets a long action aside: its work is kept when
 * its row keeps it (AT6/AT28), else lost. */
function longAction(ctx: Ctx, a: Actor, o: Order, cost: { row: DurationDef; seconds: number }): { row: DurationDef; seconds: number } | 'busy' {
  const { state } = ctx;
  const key = busyKey(cost.row, o);
  if (a.busy && a.busy.key !== key) setAside(state, a);
  const cur = a.busy?.key === key ? a.busy : undefined;
  // words are said in the turn they are ordered, all at once: a long line takes the turn's time (its share on a break waits)
  if (isSpeech(o.type)) return cost;
  if (state.mode !== 'tactical') {
    const left = cur ? Math.max(0, cur.need - cur.done) : cost.seconds;
    // AT45: the player's action longer than a turn outside a fight runs on the world clock at the end of the turn (runStretch)
    // and takes effect when its time is done; a rest has its own stretch (doRest). An NPC's still takes effect at once
    if (a !== state.player || ctx.stretch || cost.row.id === DU.rest || left <= CONFIG.EXPLORE_TURN_S + T_EPS || !wouldGo(state, a, o)) { delete a.busy; return { ...cost, seconds: left }; }
    a.busy = { row: cost.row.id, key, order: { type: o.type, target: o.target, item: o.item ?? null }, done: cur?.done ?? 0, need: cur?.need ?? cost.seconds, turn: state.turn };
    const ev = bark(mk(ctx, a, 'busy', { target: o.target ?? undefined, ...(o.item ? { itemId: o.item } : {}), busy: { row: cost.row.id, done: a.busy.done, need: a.busy.need } }), o);
    emit(ctx, ev);
    ctx.stretch = { kind: 'busy', seconds: left, pose: 'standing', ev, order: o };
    return 'busy';
  }
  const s = slotsOf(ctx, a);
  if (!cur && cost.seconds <= ctx.turnS + s.carried.main + T_EPS) return cost;
  const need = cur?.need ?? cost.seconds, done = cur?.done ?? 0, left = mainLeft(ctx, a);
  if (need - done <= left + T_EPS) { delete a.busy; return { ...cost, seconds: need - done }; }
  useMain(ctx, a, { row: cost.row, seconds: left });
  ctx.finished.delete(a.id);
  a.busy = { row: cost.row.id, key, order: { type: o.type, target: o.target, item: o.item ?? null }, done: done + left, need, turn: state.turn, ...(cur?.watch ? { watch: cur.watch } : {}) }; // AT67: its watch goes on
  emit(ctx, bark(mk(ctx, a, 'busy', { target: o.target ?? undefined, ...(o.item ? { itemId: o.item } : {}), busy: { row: cost.row.id, done: a.busy.done, need } }), o));
  return 'busy';
}
/** AT45: a long action that would be refused (no coin, nothing to sell, armour it can't put on) is refused at once, not
 * after its time; whether it still goes through is asked again when its time is done */
function wouldGo(state: GameState, a: Actor, o: Order): boolean {
  const t = o.target ? actorById(state, o.target) : undefined;
  if (o.type === 'buy') return buy(state, a, t, o.item, o.qty, (o.for ? actorById(state, o.for) : a) ?? a, true).ok;
  if (o.type === 'sell') return sell(state, a, t, o.item, o.qty, true).ok;
  if (o.type === 'equip') return equipArmor(state, a, o.item, true);
  return true;
}
/** AT6/AT28: an actor turns to something else: a long action's work stays only when its row keeps it at this progress */
function setAside(state: GameState, a: Actor): void {
  const b = a.busy!;
  const then = breakBand(b);
  if (then === 'kept') b.paused = true;
  else delete a.busy;
  if (then === 'share') shareDone(state, a, b);
  logCode(state, 'busy_set_aside', { actorId: a.id, row: b.row, done: b.done, need: b.need, kept: !!a.busy });
}
/** AT27/AT28: a long action broken off whose output is a share takes effect by the share done: a rest heals that share */
function shareDone(state: GameState, a: Actor, b: NonNullable<Actor['busy']>): void {
  if (b.row !== DU.rest || b.done <= 0) return;
  applyHealing(state, a, restRow(state, a), { share: Math.min(1, b.done / b.need) });
  state.clocks[`rest:${a.id}`] = now(state);
}
/** AT25/AT57: an attack aimed at someone at a long action breaks it by the row's focus: careful (and deep) on any attack,
 * hit or miss; steady on a hit that wounds; reflex never. What is left goes by its progress (AT6/AT28): kept or lost.
 * Share, misfire and fires wait for rows that use them in a fight (rest, talk and spells are not long here; CS5). */
function breakFocus(ctx: Ctx, t: Actor, ev: GameEvent, wounded: boolean): void {
  if (!busyNow(t)) return;
  const focus = actionRow(t.busy!.row)?.focus ?? 'reflex';
  if (!(FOCUS.pos(focus) >= FOCUS.pos('careful') || (focus === 'steady' && wounded))) return;
  breakOff(ctx.state, t, ev);
}
/** AT6/AT28: a long action broken off: what is left goes by its progress (kept, lost, or its share takes effect) */
function breakOff(state: GameState, t: Actor, ev: GameEvent): void {
  const b = t.busy!, then = breakBand(b);
  if (then === 'kept') b.paused = true;
  else delete t.busy;
  if (then === 'share') shareDone(state, t, b);
  ev.effects.push({ kind: 'broke_off', actorId: t.id, data: { row: b.row, done: b.done, need: b.need, then } });
  logCode(state, 'busy_broken', { actorId: t.id, row: b.row, done: b.done, need: b.need, then });
}

/** AT78/AT48: an attack order repeats while the actor has main time for another one, each next blow or shot resolving in
 * the order it finishes (the initiative order breaks ties). Before each, the attacker follows its target on the move time
 * left. It stops once the target is down, yielded to, out of reach after following, or the attack came to nothing. */
function repeatAttacks(ctx: Ctx, ordered: string[]): void {
  const { state } = ctx;
  for (let guard = 0; guard < 200; guard++) {
    let next: { a: Actor; o: Order; cost: { row: DurationDef; seconds: number }; at: number } | undefined;
    for (const id of ordered) {
      const a = actorById(state, id), o = ctx.orders.get(id);
      if (!a || !o || o.type !== 'attack' || !ctx.acted.has(id) || ctx.stopped.has(id) || !isActive(a)) continue;
      const cost = orderCost(state, a, o);
      if (!cost || cost.seconds <= T_EPS || mainLeft(ctx, a) + T_EPS < cost.seconds) continue;
      const at = (ctx.clock.get(id) ?? 0) + cost.seconds;
      if (!next || at < next.at - T_EPS) next = { a, o, cost, at };
    }
    if (!next) return;
    const { a, o, cost, at } = next;
    const t = o.target ? actorById(state, o.target) : undefined;
    if (!t || !isActive(t) || notInHand(state, a, o) || yieldBars(state, a, t) || truceBars(state, a, t) || stance(state, t, a) === 'yielded') { ctx.stopped.add(a.id); continue; } // broken or surrendered mid-turn: the next blow is the attacker's own call
    const near = reachOf(state, a, o);
    if (near && !near.ok()) closeInOn(ctx, a, o, near);
    if (near && !near.ok()) { ctx.stopped.add(a.id); continue; }
    ctx.at = at;
    useMain(ctx, a, cost);
    const from = ctx.events.length;
    doAttack(ctx, a, { ...o, move: null, line: null, gear: [] });
    if (ctx.events.slice(from).some((e) => e.actorId === a.id && e.kind === 'wasted')) ctx.stopped.add(a.id);
  }
}

/** AT20: each pool keeps, for the next turn only, what was left after the actor's last finished action, less any time it
 * carried in and left unused; a hold, a wait and a turn where nothing finished carry nothing. In a fight only. */
function noteCarry(ctx: Ctx): void {
  const { state } = ctx;
  for (const [id, s] of ctx.slots) {
    const a = actorById(state, id), o = ctx.orders.get(id);
    if (!a) continue;
    delete a.carry;
    if (state.mode !== 'tactical' || !o || ['hold', 'idle', 'wait', 'sleep', 'rest'].includes(o.type)) continue;
    const keep = (pool: 'main' | 'move', done: boolean) => {
      const left = pool === 'main' ? mainLeft(ctx, a) : s.move, used = ctx.turnS + s.carried[pool] - left;
      return done ? Math.max(0, left - Math.max(0, s.carried[pool] - used)) : 0;
    };
    const carry = { main: keep('main', ctx.finished.has(id)), move: keep('move', !!s.arrived), turn: state.turn };
    if (carry.main > T_EPS || carry.move > T_EPS) a.carry = carry;
  }
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
  } else if (t.frontier && trip.stop === 'arrived') doMove(ctx, a, { zone: t.frontier }, o, false, 0);
}

/** AE5/AE8: a perk move; a free one resolves beside the main action, just before it */
function doPerkMove(ctx: Ctx, a: Actor, pm: NonNullable<Order['perkMove']>): void {
  const why = perkMoveBlock(ctx.state, a, pm.perk, pm.target);
  if (why) return logCode(ctx.state, 'perk_move_dropped', { actorId: a.id, perk: pm.perk, reason: why });
  if (pm.perk === PK.battle_cry && tooSpent(a, actionRow(DU.battle_cry)?.effort)) return logCode(ctx.state, 'perk_move_dropped', { actorId: a.id, perk: pm.perk, reason: 'spent' }); // FT10
  if (pm.perk === PK.battle_cry) return doBattleCry(ctx, a);
  const r = resolvePerkMove(ctx.state, a, pm.perk, pm.target!, ctx.rng);
  emit(ctx, mk(ctx, a, 'perk_move', { target: pm.target ?? undefined, effects: r.effects, ...(r.result ? { contest: r.result } : {}) }), r.result);
}

/** I9 Battle Cry: the main action; a Loud roar heard at any level, however far (battleCry in auras.ts) */
function doBattleCry(ctx: Ctx, a: Actor): void {
  const { state, rng } = ctx;
  countPerkMove(state, a, PK.battle_cry, null);
  useMain(ctx, a, { row: actionRow(DU.battle_cry) });
  const ev = mk(ctx, a, 'battle_cry');
  ev.perception = computePerception(ev, state, rng);
  emit(ctx, ev, undefined, true);
  for (const r of battleCry(state, a, ev, rng, (t, id, gap, overwhelm) => fear(ctx, t, id, { ...(gap === undefined ? {} : { gap }), ...(overwhelm ? { overwhelm } : {}) }))) {
    ev.effects.push({ kind: r.rallied ? 'rallied' : r.took ? 'cry_took' : 'cry_resisted', actorId: r.target.id, data: { by: a.id, perk: PK.battle_cry, ...(r.overwhelmed ? { overwhelmed: true } : {}) } });
  }
}

/** the attack mode the order names by mode and item, if one in use matches */
const namedMode = (state: GameState, a: Actor, o: Order) =>
  o.mode || o.item ? usableModes(state, a).find((m) => (!o.mode || m.mode.id === o.mode) && (!o.item || m.itemId === o.item)) : undefined;
/** BG-186: the order names a weapon of the actor's that isn't in hand (sheathed, carried, or gone) */
const notInHand = (state: GameState, a: Actor, o: Order) =>
  !!o.item && o.item !== 'unarmed' && !o.item.startsWith('natural:') && !usableModes(state, a).some((m) => m.itemId === o.item);
/** the attack mode the actor would use from where it stands, or from `from` (as doAttack picks it), and the metres to the target */
function attackMode(state: GameState, a: Actor, o: Order, from: Located = a) {
  const t = o.target ? actorById(state, o.target) : undefined;
  const dist = t ? sightDistM(state, from, t) : Infinity;
  return { m: namedMode(state, a, o) ?? defaultMode(state, a, dist), dist };
}
const inReach = (state: GameState, a: Actor, o: Order, from: Located = a) => { const { m, dist } = attackMode(state, a, o, from); return !!m && withinM(dist, m.mode.reach); };
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
  const need = needOf(state, a, o.type), t = o.target ? actorById(state, o.target) : undefined;
  if (need === 'weapon' && t && t !== a && healthLevel(t) !== 'dead' && !notInHand(state, a, o) && !rangedHere(state, a, o)) { // BG-162: someone down can be struck (doAttack), so is closed in on
    const m = attackMode(state, a, o).m ?? defaultMode(state, a, 0);
    if (m) return { at: t, m: m.mode.reach, toward: t.id, ok: () => inReach(state, a, o) };
  }
  if (o.type === 'search' && t && t !== a && openToGrip(state, a, t)) return grip(t, 0, t.id); // BG-152: a body, a sleeper or a yielded foe is searched hands-on
  if (need === 'grip' && t && t !== a) return grip(t, o.type === 'restrain' || o.type === 'use_item' || o.type === 'filch' ? 0 : gripReachM(state, t), t.id); // handed over: both grip reaches; a grab (BF5), tending (BF13) or a filch (FL2): the user's
  const d = need === 'grip' && !t ? findContainer(state, o.target)?.at ?? door(o.target) : null; // CT3: a container, or a door
  if (d) return grip(d);
  for (const op of o.gear ?? []) if (op.op === 'pick_up' && !reachable(state, a, op)) { const p = pickUpAt(state, op, a); if (p) return grip(p); }
  return null;
}

/** BG-86: the actor is within grip reach of the doorway to `to` (a zone without a rectangle has no point to measure) */
function atDoor(state: GameState, a: Actor, to: string | null | undefined): boolean {
  const p = to ? wayPoint(state, a.zone, to, a) : null;
  return !p || withinGrip(state, a, { zone: a.zone, pos: p });
}

/** FR2: a pick-up whose item is within grip reach (or gone: applyGearOps reports it) */
const reachable = (state: GameState, a: Actor, op: GearOp) => { const p = pickUpAt(state, op, a); return !p || withinGrip(state, a, p); };

/** ZP3/FR4 closing in: walks at the target on the move slot, stopping once within reach; across a counter, fence or rail
 * from the actor's zone it is reached over from the actor's side of it (BG-62), unless the actor goes behind it (BG-183) */
function closeInOn(ctx: Ctx, a: Actor, o: Order, near: NonNullable<ReturnType<typeof reachOf>>, behind = false): void {
  const { state } = ctx;
  const over = !behind && near.at.zone !== a.zone && reachesAcross(state, a.zone, near.at.zone);
  const p = over ? wayPoint(state, a.zone, near.at.zone, a) : null;
  const goal: Located = p ? { zone: a.zone, pos: p } : near.at;
  walk(ctx, a, goal, o, (n) => (n === 0 ? useMoveSlot(ctx, a, false) : null), { stopShort: p ? 0 : Math.max(0, near.m - M_EPS), ...(near.toward ? { toward: near.toward } : {}) });
}

/** BF12: handing something across a way (bars, a grate, a doorway): the giver holds it out there, and the one it is for, if
 * willing (awake, not hostile, a move slot left), steps up to the way on their side to take it, as their move this turn */
function stepUpToTake(ctx: Ctx, a: Actor, o: Order): boolean {
  const { state } = ctx;
  const t = o.target ? actorById(state, o.target) : undefined;
  if (!t || t === a || t.zone === a.zone || !isActive(t) || isAsleep(t) || hostile(state, t, a)) return false;
  const mine = wayPoint(state, a.zone, t.zone, a), theirs = wayPoint(state, t.zone, a.zone, t);
  if (!mine || !theirs || !withinGrip(state, a, { zone: a.zone, pos: mine }) || slotsOf(ctx, t).move <= T_EPS) return false;
  walk(ctx, t, { zone: t.zone, pos: theirs }, nullOrder(t.id), (n) => (n === 0 ? useMoveSlot(ctx, t, false) : null), { stopShort: Math.max(0, gripReachM(state, t) - M_EPS), toward: a.id });
  return true;
}

/** AE1: the attack would be ranged from here, or (out of reach here) from where the move leads */
const rangedHere = (state: GameState, a: Actor, o: Order) => {
  const here = attackMode(state, a, o);
  const next = o.move ? shortestPath(state, a.zone, o.move)?.[0] : undefined;
  const m = here.m && withinM(here.dist, here.m.mode.reach) ? here.m : next ? attackMode(state, a, o, { zone: next }).m : here.m;
  return m?.mode.tree === 'ranged';
};
/** AE2: no running (the move role switched off by the shared-role rule, CS8) stops a dash, and so does Leg Bolt's slow (A6) */
const lame = (state: GameState, a: Actor) => slowed(state, a) || roleOff(state, a, RL.move);

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
    // LR3 Blind Spot: with a foe's sight spoiled by Dirt in the Eyes, Melt Away needs no cover or shade
    const inPlace = o.type === 'vanish' && !o.vanish && hasPerk(a, PK.melt_away) && !!zone && (blindSpotNow(state, a) || meltAwayHere(zone.cover, zoneLight(state, zone)));
    if (inPlace) o.vanish = true;
    o.type = inPlace ? 'hide' : goTo ? 'move' : 'hold';
  }
  if (o.type === 'hide') a.posture = 'stealthy';
  const r = npc && a.mind?.routine ? routine(a.mind.routine.id) : undefined;
  if (npc && o.source === 'routine' && r?.posture === 'stealthy') a.posture = 'stealthy';
  if (npc && r?.kind === 'follow' && a.bandId === state.player.bandId) a.posture = state.player.posture ?? 'open';
  if (o.line ? o.line.volume !== 'whisper' : isSpeech(o.type)) a.posture = 'open'; // BG-202: a whisper keeps you stealthy, whatever action carries it
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
 * already counts minutes. CS11: a way it can open (its key, the bolt's side) it opens and walks through when the player is
 * in neither zone, and leaves it as it was where it can: the key locks it again from either side; a bar slid back from
 * its own side can't be drawn again from the far side, so it stays open. */
export function catchUp(state: GameState, minutes: number, deductWalked = true, onLeg?: (a: Actor, from: Located, metres: number, toward: string) => void): void {
  if (minutes <= 0) return;
  const walked = (deductWalked ? state.scratch?.walked ?? {} : {}) as Record<string, number>;
  const agentRun = new Set((state.scratch?.agentRun as string[] | undefined) ?? []);
  for (const a of [...state.actors].sort((x, y) => x.id.localeCompare(y.id))) {
    const m = a.mind;
    // an NPC whose agent chose its move this turn keeps it: the catch-up is for routine time
    if (!m?.routine || agentRun.has(a.id) || !isActive(a) || isAsleep(a) || isEngaged(state, a) || a.heldBy || m.moraleState || staying(state, a)) continue;
    const d = desiredState(buildActorView(state, a.id));
    if (!d || d.zone === a.zone) continue;
    let left = travelSpeed(state, a, CONFIG.CATCH_UP_PACE) * minutes * 60 - (walked[a.id] ?? 0);
    const start = a.zone;
    for (let i = 0; i < 100 && left > M_EPS && a.zone !== d.zone; i++) {
      const gate = gateAhead(state, a, d.zone);
      const unseen = !!gate && state.player.zone !== a.zone && state.player.zone !== gate.to;
      if (gate && (gate.pass !== 'opens' || !unseen)) break; // a way that is not simply open, or opened in view
      const was = gate && { locked: !!gate.b.lock?.locked, drawn: !!gate.b.bar?.drawn };
      if (gate) openWay(gate.b, a, a.zone);
      const from = a.zone, at: Located = { zone: a.zone, ...(a.pos ? { pos: { ...a.pos } } : {}) };
      const r = walkLeg(state, a, { zone: d.zone }, left, 0, a);
      const crossed = r !== null && (r > 0 || a.zone !== from); // BG-151: a doorway underfoot is crossed in 0 m
      if (crossed && onLeg) onLeg(a, at, r, d.zone); // BF2: a leg anyone could see or hear is a walk like any other
      if (gate && was) {
        const through = a.zone === gate.to;
        if (gate.b.lock && was.locked) gate.b.lock.locked = true; // the key turns again on either side
        if (gate.b.bar && was.drawn && !through) gate.b.bar.drawn = true; // still on the bolt's side: slid back again
        if (through) logCode(state, 'catch_up_way', { actorId: a.id, barrier: gate.b.id, from, to: gate.to, ...(was.drawn ? { leftUnbarred: true } : {}) });
      }
      if (!crossed) break;
      left -= r;
    }
    if (a.zone !== start) logCode(state, 'caught_up', { actorId: a.id, from: start, to: a.zone }); // a silent jump (BF2)
  }
}

/** NW3/NW8: an NPC that walked into a frontier this turn and waits at its edge (scratch.frontierWaits, reset each turn) */
export type FrontierWait = { actorId: string; frontier: string };

export function resolveTurn(state: GameState, input: TurnInput, rng: Rng): GameEvent[] {
  if (state.scratch) { delete state.scratch.frontierWaits; delete state.scratch.walked; delete state.scratch.caughtUp; delete state.scratch.nightStopped; } // NW3/NW11: this turn's only
  (state.scratch ??= {}).agentRun = usableAgentOutputs(input).map((o) => o.actorId); // NW11: their agent moved them this turn
  const clockStart = now(state);
  const startPos = new Map<string, Located>(allActors(state).map((x) => [x.id, { zone: x.zone, ...(x.pos ? { pos: { ...x.pos } } : {}) }])); // AT67: where everyone stood
  wakeChecksNear(state, (x) => armorNoise(state, x, 'move', SENSE.move[0]), rng); // NW18: a light sleeper may hear someone hostile near
  noteZonesSeen(state); // where the turn starts: a frontier crossed after the last turn's end
  placeAll(state); // ZP1: anyone new on stage, or moved by a scenario, gets a spot in their zone
  delete state.stage.encounter; // TV4: an encounter's scenario has placed its people by now
  const learnedBefore = learned(state);
  const playerUp = isActive(state.player);
  // MB41: foes asked by the player's yield answer in this turn's output, before anyone acts
  for (const o of usableAgentOutputs(input)) answerYield(state, actorById(state, o.actorId)!, o.output.acceptYield);
  for (const o of usableAgentOutputs(input)) answerMercy(state, actorById(state, o.actorId)!, o.output.spare); // D-239
  const active = state.actors.filter(isActive);
  const views = new Map<string, ActorView>(active.map((a) => [a.id, buildActorView(state, a.id)]));
  const fired = input.fired ?? firedOrders(state);
  (state.scratch.agentRun as string[]).push(...fired.map((o) => o.actorId)); // BG-151: a trigger's order moved them too
  const orders = mergeOrders(state, input, views, fired, rng);
  const playerOrder = isAsleep(state.player) ? asleepOrder(state.player) : fromIntent(state, carryOnWalk(state, input.intent), input.aimed); // NW18: asleep, your turn passes
  const imp = input.intent?.action?.improvised;
  if (imp && playerOrder.type === 'attack' && !playerOrder.item && isActive(state.player)) {
    // loot L3: the grabbed object is minted and drawn (swap stows held weapons) before the attack
    playerOrder.item = improvise(state, state.player, imp);
    playerOrder.gear = [{ op: 'swap', item: playerOrder.item }, ...(playerOrder.gear ?? [])];
  }
  // BF37: with a broken nerve the player's walk, attack, grab, filch or perk move comes to nothing; words and the allowed
  // actions still happen, and with nothing allowed left the player cowers where they stand
  if (isActive(state.player) && moraleLevel(state.player) === 'broken') {
    const { order, blocked } = nerveHolds(playerOrder);
    if (blocked) logCode(state, 'broken_cowers', { actorId: state.player.id, wanted: playerOrder.type });
    for (const k of Object.keys(playerOrder) as (keyof Order)[]) if (!(k in order)) delete playerOrder[k];
    Object.assign(playerOrder, order);
  }
  if (isActive(state.player)) orders.set(state.player.id, playerOrder);
  // AT47: an NPC at a long action carries on with it unless its agent was asked anyway or a trigger fired for it
  for (const [id, o] of orders) {
    const x = actorById(state, id);
    if (!x || x === state.player || !busyNow(x)) continue;
    const alert = x.busy!.alert; // AT67: its coming-near check fired last turn: its new order stands
    delete x.busy!.alert;
    if (!alert && o.source !== 'trigger' && !usableAgentOutputs(input).some((u) => u.actorId === id)) orders.set(id, busyOrder(x));
  }
  // NW12/NW20: a sleeper does nothing (its agent is not asked); NW21: an awake band member who sees someone hostile
  // shouts to wake its sleeping bandmates
  for (const id of [...orders.keys()]) { const x = actorById(state, id); if (x && x !== state.player && isAsleep(x)) orders.set(id, asleepOrder(x)); }
  for (const c of wakeCalls(state)) orders.set(c.actorId, c);
  noteUnreachable(state, orders);
  // the player first: a companion copies the player's new posture
  for (const id of [...orders.keys()].sort((x, y) => (x === state.player.id ? -1 : y === state.player.id ? 1 : 0))) setPosture(state, actorById(state, id)!, orders.get(id)!);
  const ctx: Ctx = {
    state, rng, input, events: [], orders, acted: new Set(), slots: new Map(), surprised: new Set(), defenses: new Map(), exchangeEvents: [], counters: new Set(), parryStrikes: new Set(),
    turnS: state.mode === 'tactical' ? turnSeconds(state, playerOrder) : CONFIG.FIGHT_TURN_S, clock: new Map(), at: 0, finished: new Set(), stopped: new Set(), spoke: new Set(),
  };
  // Dreaded on Sight: whoever first sees the owner pays its fear and turns colder, before anyone acts
  for (const c of sightDread(state, (a, id) => fear(ctx, a, id))) logCode(state, 'dreaded_on_sight', { actorId: c.target.id, by: c.owner.id, perk: c.perk });
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
  const init = initiativeOrder(state, [...orders.keys()].sort((x, y) => (x === state.player.id ? -1 : y === state.player.id ? 1 : x < y ? -1 : 1)), orders, rng);
  const ordered = init.order;
  // AT58/AT60: a reaction or a hesitation: the actor's time starts that many seconds into the turn, and it walks no sooner
  for (const [id, wait] of init.delay) { const a = actorById(state, id); if (!a) continue; ctx.clock.set(id, wait); const s = slotsOf(ctx, a); s.move = Math.max(0, s.move - wait); }

  // exchange slot: the player's speech, then spokespeople's spoken replies in initiative order
  const ex = input.exchange;
  if (ex && isActive(state.player) && (isSpeech(playerOrder.type) || input.quickWord)) {
    // BG-58: walk over, then speak: the player's move comes first and the words are said from where it ends, as an NPC's
    const po = playerOrder;
    if (po.move && !po.moveAfter && !po.way && !(input.quickWord && state.mode === 'tactical')) { // Quick Word speaks first; an aside (OA1) walks over first
      const { goal, opts } = moveGoal(state, state.player, po);
      if (!walk(ctx, state.player, goal, po, (n) => (n === 0 ? useMoveSlot(ctx, state.player, false) : null), opts)) logCode(state, 'move_dropped', { actorId: state.player.id, to: po.move });
      // BG-185: a walk the player ordered (or one carrying on) still goes on after the words (AT49); a step up only to be
      // heard (BG-74, no move given) is done once they are said
      if (input.intent?.move || state.player.walking) ctx.saidOnWay = { ...po };
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
    playerOffers(ctx, ev, ex); // TF13: words that are an offer to stop fighting
    if (input.quickWord) playerOrder.line = null; // A15/OA1: the line was said; the action follows in turn order
    else { useMain(ctx, state.player, orderCost(state, state.player, playerOrder)); ctx.spoke.add(state.player.id); }
    const spokes = new Set(input.spokespeople);
    for (const id of ordered) {
      const o = orders.get(id);
      const a = actorById(state, id);
      if (!spokes.has(id) || !o || !a || !isActive(a) || o.source !== 'agent') continue;
      if (!isSpeech(o.type)) {
        // A15 Quick Word, OA1 asides: a spoken reply is free; the reply's action still comes in turn order
        if (!input.quickWord || !o.line) continue;
        doSpeak(ctx, a, { ...o, type: 'talk', target: state.player.id });
        o.line = null;
      } else {
        // the reply is the main action; the actor still takes its turn in order for gear, defense and its move (Q2)
        useMain(ctx, a, orderCost(state, a, o));
        ctx.spoke.add(id);
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

  // TF15/TF11: answers to offers to stand down (this turn's Responders, later outputs, the player's intent), before the blows
  for (const d of answerOffers(state, usableAgentOutputs(input))) emitStandDown(ctx, d);
  if (input.intent?.standDown) { const d = answerOffer(state, state.player, input.intent.standDown, false); if (d) emitStandDown(ctx, d); }

  // NW12: the player's wait or sleep goes last, so everyone has acted on this turn's orders before the clock moves on
  const skipsTime = (id: string) => id === state.player.id && ['wait', 'sleep'].includes(orders.get(id)?.type ?? '');
  for (const id of ordered) if (!ctx.acted.has(id) && !skipsTime(id)) step(ctx, id);
  repeatAttacks(ctx, ordered); // AT78/AT48: attacks repeat while the turn's time lasts, in the order they finish
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
    // CS5: "since its last call" is the previous turn and this turn's exchange
    heardSpeech: (id, toward) =>
      (views.get(id)?.perceived ?? []).some((e) => e.kind === 'speak' && e.actorId === toward && e.turn >= state.turn - 1) ||
      (input.spokespeople.includes(id) && toward === state.player.id && ctx.exchangeEvents.length > 0),
    heardExchange: (id) => ctx.exchangeEvents.some((e) => !!e.perception[id]),
    heardNow: (listener, speaker) => ctx.events.some((e) => e.actorId === speaker && !!e.line && hearsWords(e.perception[listener])),
  });
  // SP5: "I yield" in a spar leaves it; MB40: in a real fight it yields to the foes fighting the player. After the turn's blows
  if (input.intent?.yields && isActive(state.player)) (sparOf(state, state.player.id) ? yieldSpar(state, state.player) : playerYields(state));
  letSearch(state, state.player, input.intent?.letsSearch); // BF16
  if (state.scratch?.firedOrders) state.scratch = { ...state.scratch, firedOrders: [] };
  const defeated = payDefeats(state, ctx.events);
  offersFromDefeats(state, defeated, rng); // growth proposal 2.3: a notable foe beaten may offer an essence
  expireOffers(state);
  updatePacing(state, ctx.events, learnedBefore);
  // BF2a-d: each catch-up leg is a move event, perceived by the normal rules (nobody near: still silent). BF2e: on a longer
  // turn (a trade, a rest, a wait) the legs are summed up for the Narrator (cameAndWent); asleep, the player notices none
  const legs = (long: boolean) => !long || !isAsleep(state.player) ? (m: Actor, from: Located, metres: number, toward: string) => {
    const leg = { metres: r1(metres), ...(from.pos ? { fromPos: from.pos } : {}), ...(m.zone !== from.zone ? { fromZone: from.zone } : { heading: toward }), ...(long ? { summed: true as const } : {}) };
    emit(ctx, withActivity(ctx, m, mk(ctx, m, 'move', leg), 'walk'));
  } : undefined;
  // AT45/AT46/AT49: the player's walk. Outside a fight it is one turn whatever its length: what the turn's move time left,
  // the world clock walks; in a fight a walk not yet at its goal carries on next turn by itself. At its goal, at a way found
  // shut (BG-69), after a road trip, or with another long thing to do, it ends (BG-184: at its goal it always ends)
  const p = state.player, wo = playerOrder.move ? playerOrder : ctx.saidOnWay; // BG-185: words said on the way
  if (!wo?.move || wo.way || ctx.travelled || !isActive(p) || !ctx.acted.has(p.id) || walkThere(state, p, wo) || foundShut(ctx.events, p)) delete p.walking;
  else if (state.mode === 'tactical') p.walking = walkOf(wo);
  else if (ctx.stretch) delete p.walking;
  else {
    const { goal } = moveGoal(state, p, wo), walkS = moveSpeed(state, p).walk, m = distOrNull(state, p, goal);
    if (m !== null && walkS > 0) {
      const ev = [...ctx.events].reverse().find((e) => e.actorId === p.id) ?? mk(ctx, p, 'hold');
      if (!ctx.events.includes(ev)) emit(ctx, ev);
      ctx.stretch = { kind: 'walk', seconds: (m / walkS) * 2 + CONFIG.STEP_MAX_S, pose: 'standing', ev, walk: wo };
    } else delete p.walking; // an old map's zone with no rectangle: the turn's own walk only
  }
  const stretch = state.mode !== 'tactical' && isActive(state.player) ? ctx.stretch : undefined;
  if (stretch?.kind === 'walk' || stretch?.kind === 'busy') passTime(state, slotsOf(ctx, state.player).walkedS / 60); // the turn's own walk came first
  if (stretch) runStretch(ctx, stretch, legs(true)); // AT56: a rest, a wait, a walk or a long action runs on the world clock, step by step
  else passTime(state, (state.mode === 'tactical' ? ctx.turnS : exploreSeconds(ctx, playerOrder)) / 60); // AT13/AT46: every turn lasts its order's time
  keepFollowing(ctx, wo);
  const catchMin = now(state) - clockStart - ((state.scratch?.caughtUp as number | undefined) ?? 0);
  const long = !!stretch || catchMin > (getLibrary().durations?.[DU.action]?.seconds ?? 0) / 60;
  if (!state.scratch?.nightStopped) catchUp(state, catchMin, true, legs(long));
  if (long) for (const e of ctx.events) if (e.kind === 'move' && e.actorId !== state.player.id && !e.line) e.summed = true; // BF2e3: their own move is in their one line too // NW12: a sleep stopped by an arrival keeps them there; NW11: the turn's time moves everyone on toward their schedule (a night already moved them)
  settleSleepers(state); // NW20: NPCs fall asleep and wake by their routines
  // NW18/AT42: still asleep (whoever came never woke you): the rest of the night runs on as one stretch, the people already
  // there accepted; it stops again on a newcomer or a foe reaching you
  if (state.night && isAsleep(state.player) && !state.scratch?.nightStopped) runNight(ctx);
  headArrivals(state); // NW2: a head_to walk the catch-up brought there
  runSteps(state); // UG16: a goal holder's finished step gives way to its next
  noticeGoals(state); // UG7 moment 3: a goal holder that perceives what a goal names thinks next
  updateQuests(state, ctx.events, defeated);
  noteZonesSeen(state);
  if (playerUp && !isActive(state.player)) playerDown(state, rng);
  else if (state.mercy && state.mercy.turn < state.turn) (settleMercy(state) && healthLevel(state.player) !== 'dead' ? wakeUp(state, 'player_spared') : logCode(state, 'player_fell', { lethal: true })); // D-239
  updateChase(state); // CH6/CH7: pursuers follow through frontiers; a chase lost for CHASE_LOST_S ends
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
  for (const x of allActors(state)) fadeSoulbound(state, x); // HF18
  releaseHolds(state, allActors(state));
  noteGains(state); // D-226: this turn's raises go on the scenario's gains summary
  if (state.stage.breakCause) { // SC6: record the scenario; SC4: an inner scenario's end resumes the bigger one
    closeScenario(state, rng);
    // achievements granted at the scenario's end give their Threadbound item abilities and linked perks now, not a turn later
    syncThreadboundItemPerks(state.player, state.turn); syncPerkLinks(state.player, state.turn);
  }
  noteCarry(ctx); // AT20: what is left after each actor's last finished action
  // AT47/AT67: an NPC at a long action in a fight runs its coming-near check on the turn; fired, it is asked again next turn
  if (state.mode === 'tactical') for (const x of state.actors) {
    if (!isActive(x) || isAsleep(x) || !busyNow(x)) continue;
    const fired = busyCheck(state, x, startPos, ctx.turnS, ctx.events);
    if (fired) { x.busy!.alert = true; logCode(state, 'busy_alert', { actorId: x.id, why: fired.why, by: fired.by }); }
  }
  noteTurnEnd(state); // AT15: timers count game time from turn stamps
  state.events.push(...ctx.events);
  return ctx.events;
}

/** D-54: the player went down this turn. The fight is lethal when an active actor hostile to the player belongs to a band
 * marked lethal (the default): the story ends on the "You fell" screen, unless a foe is asked to spare them (D-239: settled
 * next turn). Otherwise (a band marked not lethal, a spar, or no one left to finish the job) one survival roll: Near Miss
 * or better wakes somewhere safe at Critical (the next scenario). */
function playerDown(state: GameState, rng: Rng): void {
  const p = state.player;
  if (p.engagement?.fight) p.engagement.fight.down = true; // a lost fight, even if the player wakes (the Loser scars)
  if (healthLevel(p) === 'dead') return;
  if (finishers(state).length) {
    if (!askMercy(state)) logCode(state, 'player_fell', { lethal: true });
    return;
  }
  const r = survivalRoll(rng);
  logCode(state, 'survival_roll', { d100: r.d100, tier: r.tier, survived: r.survived });
  if (r.survived) { tally(state, 'survival_rolls'); wakeUp(state); }
}

/** D-54/D-239: the downed player lives: wakes somewhere safe at Critical, in the next scenario */
function wakeUp(state: GameState, code?: string): void {
  if (code) logCode(state, code, {});
  state.player.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'critical')![1];
  state.stage.breakCause = 'knocked_out';
}

// ---------- pacing (P7) ----------

/** how much the player knows: secrets, witnessed facts, names */
function learned(state: GameState): number {
  const j = state.player.journal;
  return j ? j.secretsKnown.length + j.factsWitnessed.length + j.namesKnown.length : 0;
}

/**
 * A quiet turn: no attack, nothing new learned, no beat fired (the beat's own reset), never one in a fight (AT76). A stall (STALL_TURNS quiet turns
 * with no beat left) marks the scenario to end as worn out, and free roam starts (SD2 a). Rest, sleep and time skips
 * never end a scenario (SC4, SC9).
 */
function updatePacing(state: GameState, events: GameEvent[], learnedBefore: number): void {
  const quiet = !events.some((e) => e.kind === 'attack') && learned(state) === learnedBefore;
  // AT76: a quiet turn in a fight (a standoff) is not the story stalling: it neither counts nor resets
  state.stage.quiet = !quiet ? 0 : (state.stage.quiet ?? 0) + (state.mode === 'tactical' ? 0 : 1);
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

