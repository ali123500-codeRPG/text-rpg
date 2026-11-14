// One order per active actor: trigger > surrendered > agent (dialogue call, else Planner) > onAlert > routine / combat list.
import { suspicionOrder } from './suspicion';
import type { Actor, ActorView, GameState, Intent, NpcAction, Order, Rng, Volume } from '../types';
import type { NoiseKey } from '../scales';
import { CONFIG } from '../config';
import { SPEECH_ACTIONS } from '../types';
import { VOLUME_NOISE } from '../perception/noise';
import { hearsClearly } from '../perception';
import { alertOrders, brokenOrder, fallbackOrder, followMove, nerveHolds, routineOrder, staying } from '../minds';
import { actorById, isEngaged, reachesAcross, seesAcross, zoneById } from './relations';
import type { AcceptedAgentOutput, TurnInput } from './types';
import { slotMetres } from './speed';
import { M_EPS, distM, gateAhead, spotPoint, walkLeg, withinM, type Located } from './position';
import { canSpeak } from '../ruleset/body';

/** FR4: the one approach table: what each action needs of the actor's distance to its target, for every actor, player
 * or NPC. voice: the target hears it clearly (words, an order called out: BG-74, BG-78); approachMove plans the step up
 * before the turn, since the words are said first (BG-58). grip: within grip reach in metres (the body's grip parts;
 * both sides' when handing over: FR2); weapon: within the attack's reach (ZP3). Grip and weapon needs close in on the
 * move slot when the action comes (resolve.ts closeIn), so a target that moved meanwhile is still walked at. */
export type Need = 'voice' | 'grip' | 'weapon';
/** the need of an action by this actor: a buy or sell from someone who cannot speak is pointed at and paid in person (grip) */
export function needOf(state: GameState, actor: Actor, type: string): Need | undefined {
  return TRADE_KINDS.includes(type) && !canSpeak(state, actor) ? 'grip' : NEEDS[type];
}
export const NEEDS: Record<string, Need> = {
  ...Object.fromEntries(SPEECH_ACTIONS.map((t) => [t, 'voice' as const])), buy: 'voice', sell: 'voice',
  give: 'grip', take: 'grip', pick: 'grip', open: 'grip', break: 'grip', filch: 'grip', restrain: 'grip', extract: 'grip', interact: 'grip', use_item: 'grip', attack: 'weapon', // use_item: BF13, on someone else
};

/** BG-80: the move an actor makes for an action at someone (one rule for talking, trading and handing over, by NEEDS):
 * - no move given and the target is in view but not near enough: step up to them first (BG-74);
 * - going over to someone ends beside them, in the actor's own zone or theirs, or on the actor's side of a counter, fence or
 *   rail unless they go behind it (move.behind) (BG-62, BG-87);
 * - a move through a doorway to another room while acting (following someone in) stands (BG-77). */
export function approachMove(state: GameState, actor: Actor, act: { type: string; target: string | null; volume?: Volume; way?: boolean }, given: Intent['move']): Intent['move'] {
  let m = given;
  const need = needOf(state, actor, act.type);
  if (!need || !act.target) return m;
  const t = actorById(state, act.target), here = actor.zone;
  if (!t || t.id === actor.id || need === 'weapon') return m; // a foe is closed in on when the blow comes (resolve.ts closeIn)
  const noise: NoiseKey = TRADE_KINDS.includes(act.type) ? CONFIG.ORDER_NOISE : VOLUME_NOISE[act.volume ?? 'normal'];
  const inView = t.zone === here || !!zoneById(state, here)?.links.some((l) => l.to === t.zone && seesAcross(state, l));
  if (!m && !act.way && need === 'voice' && inView && !hearsClearly(state, actor, t, noise)) m = { toZone: t.zone };
  if (!m || m.after || m.jump || act.way) return m;
  if (t.zone === here) {
    if (m.toZone === here) return m.spot ? m : { ...m, toZone: here, spot: { near: t.id } };
    return m.spot?.near === t.id || reachesAcross(state, here, m.toZone) ? { ...m, toZone: here, spot: { near: t.id } } : m;
  }
  if (m.toZone !== t.zone) return m;
  if (!m.behind && reachesAcross(state, here, t.zone)) return { ...m, toZone: here, spot: { near: t.zone } };
  // BG-87: going into their zone ends beside them, not just inside the way in
  return m.spot ? m : { ...m, spot: { near: t.id } };
}
const TRADE_KINDS = ['buy', 'sell'];

/** the player's move for the Parser's intent (approachMove) */
export function talkMove(state: GameState, intent: Intent | null): Intent['move'] {
  const a = intent?.action;
  if (!a) return intent?.move ?? null;
  return approachMove(state, state.player, { type: a.type, target: a.target, volume: intent?.volume, way: !!intent?.way }, intent?.move ?? null);
}

/** BG-84: where the player says this turn's words from: the exchange walk (BG-58: walk over, then speak) projected on a
 * copy of the player's spot, one move slot, stopping at a way that is not open to them as the real walk does */
export function speakingSpot(state: GameState, intent: Intent): Located {
  const p = state.player, o = fromIntent(state, intent, false);
  const at: Located & { placeId?: string } = { zone: p.zone, ...(p.pos ? { pos: { ...p.pos } } : {}), placeId: p.placeId };
  if (!o.move || o.moveAfter || intent.way) return at;
  const sp = o.moveSpot ? spotPoint(state, o.move, o.moveSpot, p) : null;
  const goal: Located = sp ? { zone: o.move, pos: sp.pos } : { zone: o.move };
  const stop = sp?.stopShort ?? 0;
  let left = slotMetres(state, p, 'move');
  for (let legs = 0; legs < 100 && left > M_EPS; legs++) {
    if (goal.pos ? withinM(distM(state, at, goal), stop) : at.zone === goal.zone) break;
    const zone = at.zone;
    const r = walkLeg(state, at, goal, left, stop, p, !!gateAhead(state, { ...p, ...at }, goal.zone));
    if (r === null || (!r && at.zone === zone)) break; // BG-170: a 0 m doorway crossing goes on
    left -= r;
  }
  return at;
}

/** Order for the player from the Parser's intent (aimed is code-set). Spoken words beside a non-speech action are a bark. */
export function fromIntent(state: GameState, intent: Intent | null, aimed: boolean): Order {
  const a = intent?.action, mv = talkMove(state, intent);
  return {
    actorId: state.player.id,
    type: a?.type ?? 'hold',
    target: a?.target ?? null,
    skill: a?.skill ?? null,
    intent: a?.approach ?? '',
    source: 'player',
    move: mv?.toZone ?? null,
    ...(mv?.after ? { moveAfter: true } : {}),
    ...(mv?.pace ? { pace: mv.pace } : {}),
    ...(mv?.spot ? { moveSpot: mv.spot } : {}),
    ...(mv?.jump ? { jump: true as const } : {}),
    ...(intent?.perkMove ? { perkMove: intent.perkMove } : {}),
    ...(intent?.way ? { way: intent.way } : {}),
    targetPart: a?.targetPart ?? null,
    aimed: (!!aimed || (!!a?.aimed && !!a.targetPart)) && a?.type === 'attack', // BG-200: the Aim button, or words that aim at a part
    item: a?.item ?? null,
    ...(a?.qty ? { qty: a.qty } : {}),
    ...(a?.for ? { for: a.for } : {}),
    mode: a?.mode ?? null,
    gear: intent?.gear ?? null,
    line: intent?.spoken ? { text: intent.spoken, volume: intent.volume ?? 'normal' } : null,
    addressees: intent?.addressees ?? undefined,
  };
}

export function npcActionToOrder(actorId: string, action: NpcAction, extra: Partial<Order>): Order {
  return {
    actorId, type: action.type, target: action.target, skill: action.skill, intent: action.intent, source: 'agent',
    targetPart: action.targetPart, aimed: !!action.aimed, defense: action.defense, item: action.item, ...(action.qty ? { qty: action.qty } : {}), mode: action.mode, ...extra,
  };
}

/** Q2: a Planner or Responder's move beside its action, as the player's; an action that is itself a move keeps only that */
const MOVE_ACTIONS = ['move', 'flee', 'sneak', 'vanish'];
function npcMove(state: GameState, o: AcceptedAgentOutput): Partial<Order> {
  const act = o.output.action;
  if (MOVE_ACTIONS.includes(act.type)) return {};
  const m = o.agent === 'voice' ? null : o.output.move?.toZone ? o.output.move : null;
  // BG-80: an NPC talking to, trading with or handing something to someone steps up to them the same way as the player
  const a = actorById(state, o.actorId);
  const vol = o.agent === 'voice' ? o.output.volume : o.output.dialogue?.volume;
  const given: Intent['move'] = m ? { toZone: m.toZone, ...(m.after ? { after: true } : {}) } : null;
  const mv = a ? approachMove(state, a, { type: act.type, target: act.target, volume: vol }, given) : given;
  if (!mv?.toZone) return {};
  // BF36: words beside a move the NPC chose are said as it sets off, unless it chose to say them at the end (speakAt);
  // a walk up to someone to be heard (approachMove) still comes first. A spoken action is then done first; a line beside
  // another action is said on its own before the walk
  const talks = (SPEECH_ACTIONS as readonly string[]).includes(act.type);
  const words = !!(o.agent === 'voice' ? o.output.line : o.output.dialogue?.line) || talks;
  const first = !!m && words && !mv.after && m.speakAt !== 'end' && mv.toZone === m.toZone && !mv.spot;
  return { move: mv.toZone, ...(mv.after || (first && talks) ? { moveAfter: true } : {}), ...(first && !talks ? { wordsFirst: true as const } : {}), ...(mv.spot ? { moveSpot: mv.spot } : {}) };
}

/** BG-132: a dialogue call's line (Responder, Voice) answers the player, so it is for them whatever action carries it */
export function agentLine(o: AcceptedAgentOutput, playerId?: string): Order['line'] {
  const to = o.agent !== 'planner' && playerId ? { to: playerId } : {};
  if (o.agent === 'voice') return o.output.line ? { text: o.output.line, volume: o.output.volume, ...to } : null;
  return o.output.dialogue ? { text: o.output.dialogue.line, volume: o.output.dialogue.volume, ...to } : null;
}

/** the agent outputs that count this turn: dialogue calls for spokespeople, the Responder for beat speakers (BG-50), Planner for
 * the rest; actor-id order. */
export function usableAgentOutputs(input: TurnInput): AcceptedAgentOutput[] {
  const sp = new Set(input.spokespeople), beat = new Set(input.beatSpeakers ?? []);
  return [...input.agentOutputs]
    .filter((o) => (sp.has(o.actorId) ? o.agent !== 'planner' : beat.has(o.actorId) ? o.agent === 'responder' : o.agent === 'planner'))
    .sort((a, b) => (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0));
}

/** NPC orders by actor id (active actors only: `views` holds their ActorViews). */
export function mergeOrders(state: GameState, input: TurnInput, views: Map<string, ActorView>, fired: Order[], rng: Rng): Map<string, Order> {
  const out = new Map<string, Order>();
  const ids = [...views.keys()].sort();
  for (const o of fired) if (views.has(o.actorId) && !out.has(o.actorId)) out.set(o.actorId, o);
  for (const id of ids) {
    if (out.has(id)) continue;
    const v = views.get(id)!;
    if (v.self.surrendered) out.set(id, brokenOrder(v)); // BF37: a broken one keeps what its mind chose, less what its nerve blocks
  }
  const agent = new Map<string, Order>();
  for (const o of usableAgentOutputs(input)) {
    if (!views.has(o.actorId) || agent.has(o.actorId)) continue;
    const order = npcActionToOrder(o.actorId, o.output.action, { gear: o.output.gear, line: agentLine(o, state.player.id), ...npcMove(state, o) });
    // BG-34: a follower out of a fight walks after the player beside the action its agent gave
    const follow = !order.move && !MOVE_ACTIONS.includes(order.type) && !isEngaged(state, actorById(state, o.actorId)!) ? followMove(views.get(o.actorId)!) : null;
    agent.set(o.actorId, follow ? { ...order, move: follow } : order);
  }
  for (const [id, o] of agent) {
    const cur = out.get(id);
    if (!cur) out.set(id, o);
    // a fired trigger or Flee wins; the call's line is kept only as a bark
    else if (!cur.line && o.line) out.set(id, { ...cur, line: o.line });
  }
  // BG-94: onAlert is the reaction of the moment the alarm rises. An actor whose turn a higher order already takes (a trigger,
  // flight, its own agent) has reacted another way, so the shout is spent, never saved for a later, calmer turn.
  for (const id of out.keys()) {
    const alarm = actorById(state, id)?.mind?.alarm;
    if (alarm?.onAlertDue) delete alarm.onAlertDue;
  }
  const pendingViews = ids.filter((id) => !out.has(id)).map((id) => views.get(id)!);
  for (const o of alertOrders(state, pendingViews)) if (!out.has(o.actorId) && views.has(o.actorId)) out.set(o.actorId, o);
  for (const id of ids) {
    if (out.has(id)) continue;
    const v = views.get(id)!;
    const a = actorById(state, id)!;
    // BF11: one staying where its own agent took it holds there instead of walking its routine
    const watch = isEngaged(state, a) ? undefined : suspicionOrder(state, a, v); // GD3: a code-run guard keeps close to someone it suspects
    out.set(id, isEngaged(state, a) ? fallbackOrder(v, rng) : watch ?? (staying(state, a) ? { actorId: id, type: 'hold', target: null, skill: null, intent: 'stays put', source: 'routine' } : routineOrder(v)));
  }
  // BF37: a broken nerve takes away any walk, attack or perk move; with nothing allowed left the actor cowers
  for (const id of ids) if (views.get(id)!.self.broken && !views.get(id)!.self.surrendered) out.set(id, nerveHolds(out.get(id)!).order);
  return out;
}
