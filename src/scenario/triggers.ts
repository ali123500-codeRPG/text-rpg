// The rules every trigger meets, wherever it comes from: a stage plan's seeds (validate.ts) or a beat a Weaver check-in adds
// to a running scenario (SC8, engine/scenarioEnd.ts). One function, so both read the same rules.
import { ORDER_TYPES, WAY_ORDERS } from '../types';
import type { GameState, StagePlan, TriggerWhen } from '../types';

export const TRIGGER_TYPES: TriggerWhen['type'][] = ['player_seen_in_zone', 'turn_reached', 'actor_down', 'alarm_heard', 'quiet_turns'];

type Refs = { isZone: (r: string) => boolean; isActor: (r: string) => boolean };

/** what is wrong with a trigger's condition */
export function whenErrors(where: string, w: TriggerWhen | undefined, { isZone, isActor }: Refs): string[] {
  if (!w || !TRIGGER_TYPES.includes(w.type)) return [`${where}: unknown trigger type ${w?.type}`];
  const out: string[] = [];
  if (w.type === 'player_seen_in_zone' && !isZone(w.zone)) out.push(`${where}: zone ${w.zone} unknown`);
  if (w.type === 'actor_down' && !isActor(w.actorId)) out.push(`${where}: actor ${w.actorId} unknown`);
  if (w.type === 'turn_reached' && typeof w.turn !== 'number') out.push(`${where}: turn is a number`);
  if (w.type === 'quiet_turns' && !(Number.isInteger(w.turns) && w.turns >= 1)) out.push(`${where}: turns is a whole number of at least 1`);
  return out;
}

/** what is wrong with a trigger: its id, owner, condition, its one order and `once` */
export function triggerErrors(_state: GameState | null, t: StagePlan['seeds']['triggers'][number], refs: Refs, where = 'trigger'): string[] {
  if (!t || !t.id) return [`${where}: trigger without an id`];
  const out: string[] = [];
  if (!refs.isActor(t.ownerId)) out.push(`trigger ${t.id}: owner ${t.ownerId} unknown`);
  out.push(...whenErrors(`trigger ${t.id}`, t.when, refs));
  // one order per trigger: `then` is a single order template
  if (!t.then || Array.isArray(t.then) || typeof t.then.type !== 'string') out.push(`trigger ${t.id}: then holds exactly one order`);
  else if (!(ORDER_TYPES as readonly string[]).includes(t.then.type)) out.push(`trigger ${t.id}: then.type ${t.then.type} unknown; known: ${ORDER_TYPES.join(', ')}`);
  else if (WAY_ORDERS.includes(t.then.type) && (t.then.target === '$player' || (!!t.then.target && refs.isActor(t.then.target))))
    out.push(`trigger ${t.id}: ${t.then.type} opens a lock on a way, so its target is a zone, never a person (there is no stealing)`);
  if (t.once !== undefined && typeof t.once !== 'boolean') out.push(`trigger ${t.id}: once is true or false`);
  return out;
}
