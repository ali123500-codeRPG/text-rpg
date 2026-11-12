// One order per active actor: trigger > broken > agent (dialogue call, else Planner) > onAlert > routine / combat list.
import type { ActorView, GameState, Intent, NpcAction, Order, Rng } from '../types';
import { alertOrders, brokenOrder, fallbackOrder, followMove, routineOrder } from '../minds';
import { isEngaged } from './relations';
import type { AcceptedAgentOutput, TurnInput } from './types';

/** Order for the player from the Parser's intent (aimed is code-set). Spoken words beside a non-speech action are a bark. */
export function fromIntent(state: GameState, intent: Intent | null, aimed: boolean): Order {
  const a = intent?.action;
  return {
    actorId: state.player.id,
    type: a?.type ?? 'hold',
    target: a?.target ?? null,
    skill: a?.skill ?? null,
    intent: a?.approach ?? '',
    source: 'player',
    move: intent?.move?.toZone ?? null,
    ...(intent?.move?.after ? { moveAfter: true } : {}),
    ...(intent?.move?.pace ? { pace: intent.move.pace } : {}),
    ...(intent?.move?.spot ? { moveSpot: intent.move.spot } : {}),
    ...(intent?.move?.jump ? { jump: true as const } : {}),
    ...(intent?.perkMove ? { perkMove: intent.perkMove } : {}),
    ...(intent?.way ? { way: intent.way } : {}),
    targetPart: a?.targetPart ?? null,
    aimed: !!aimed && a?.type === 'attack',
    item: a?.item ?? null,
    ...(a?.qty ? { qty: a.qty } : {}),
    ...(a?.for ? { for: a.for } : {}),
    mode: a?.mode ?? null,
    gear: intent?.gear ?? null,
    line: intent?.spoken ? { text: intent.spoken, volume: 'normal' } : null,
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
function npcMove(o: AcceptedAgentOutput): Partial<Order> {
  if (o.agent === 'voice') return {};
  const m = o.output.move;
  if (!m?.toZone || MOVE_ACTIONS.includes(o.output.action.type)) return {};
  return { move: m.toZone, ...(m.after ? { moveAfter: true } : {}) };
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
    const order = npcActionToOrder(o.actorId, o.output.action, { gear: o.output.gear, line: agentLine(o), ...npcMove(o) });
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
