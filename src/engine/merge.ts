// One order per active actor: trigger > broken > agent (dialogue call, else Planner) > onAlert > routine / combat list.
import type { Actor, ActorView, GameState, Intent, NpcAction, Order, Rng, Volume } from '../types';
import type { NoiseKey } from '../scales';
import { CONFIG } from '../config';
import { SPEECH_ACTIONS } from '../types';
import { VOLUME_NOISE } from '../perception/noise';
import { hearsClearly } from '../perception';
import { alertOrders, brokenOrder, fallbackOrder, followMove, routineOrder } from '../minds';
import { actorById, isEngaged, reachesAcross, seesAcross, zoneById } from './relations';
import type { AcceptedAgentOutput, TurnInput } from './types';

/** BG-80: what an action needs of the actor's distance to its target. One table for every actor, player or NPC:
 * - voice: the target must hear it clearly (words, an order called out: BG-74, BG-78);
 * - hand: the target must be within hand reach: the same zone, or across a counter, fence or rail (edge kind "Low"). */
const NEEDS: Record<string, 'voice' | 'hand'> = {
  ...Object.fromEntries(SPEECH_ACTIONS.map((t) => [t, 'voice' as const])), buy: 'voice', sell: 'voice', give: 'hand',
};

/** does `actor` already stand near enough `t` for an action that needs `need` */
function nearEnough(state: GameState, actor: Actor, t: Actor, need: 'voice' | 'hand', noise: NoiseKey): boolean {
  if (need === 'hand') return t.zone === actor.zone || reachesAcross(state, actor.zone, t.zone);
  return hearsClearly(state, actor, t, noise);
}

/** BG-80: the move an actor makes for an action at someone (one rule for talking, trading and handing over):
 * - no move given and the target is in view but not near enough: step up to them first (BG-74);
 * - going over to someone ends beside them, in the actor's own zone or theirs, or on the actor's side of a counter, fence or
 *   rail unless they go behind it (move.behind) (BG-62, BG-87);
 * - a move through a doorway to another room while acting (following someone in) stands (BG-77). */
export function approachMove(state: GameState, actor: Actor, act: { type: string; target: string | null; volume?: Volume; way?: boolean }, given: Intent['move']): Intent['move'] {
  let m = given;
  const need = NEEDS[act.type];
  if (!need || !act.target) return m;
  const t = actorById(state, act.target), here = actor.zone;
  if (!t || t.id === actor.id) return m;
  const noise: NoiseKey = TRADE_KINDS.includes(act.type) ? CONFIG.ORDER_NOISE : VOLUME_NOISE[act.volume ?? 'normal'];
  const inView = t.zone === here || !!zoneById(state, here)?.links.some((l) => l.to === t.zone && seesAcross(state, l));
  if (!m && !act.way && inView && !nearEnough(state, actor, t, need, noise)) m = { toZone: t.zone };
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
    aimed: !!aimed && a?.type === 'attack',
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
  return { move: mv.toZone, ...(mv.after ? { moveAfter: true } : {}), ...(mv.spot ? { moveSpot: mv.spot } : {}) };
}

export function agentLine(o: AcceptedAgentOutput): Order['line'] {
  if (o.agent === 'voice') return o.output.line ? { text: o.output.line, volume: o.output.volume, introduces: o.output.introduces } : null;
  return o.output.dialogue ? { text: o.output.dialogue.line, volume: o.output.dialogue.volume, introduces: o.output.dialogue.introduces } : null;
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
    if (v.self.broken || v.self.surrendered) out.set(id, brokenOrder(v));
  }
  const agent = new Map<string, Order>();
  for (const o of usableAgentOutputs(input)) {
    if (!views.has(o.actorId) || agent.has(o.actorId)) continue;
    const order = npcActionToOrder(o.actorId, o.output.action, { gear: o.output.gear, line: agentLine(o), ...npcMove(state, o) });
    // BG-34: a follower out of a fight walks after the player beside the action its agent gave
    const follow = !order.move && !MOVE_ACTIONS.includes(order.type) && !isEngaged(state, state.actors.find((x) => x.id === o.actorId)!) ? followMove(views.get(o.actorId)!) : null;
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
    const a = state.actors.find((x) => x.id === id)!;
    out.set(id, isEngaged(state, a) ? fallbackOrder(v, rng) : routineOrder(v));
  }
  return out;
}
