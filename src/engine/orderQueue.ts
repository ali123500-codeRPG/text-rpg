// D-20 b: the rest of a long order (the Parser's deferred) is queued and plays one step per turn. The queue stops the moment
// anything new happens to the player: they are seen, hit or spoken to, someone comes into view, or a step fails.
import type { GameEvent, GameState, LogLine } from '../types';
import { TIERS } from '../scales';
import { contact, inSenses } from './comingNear';
import { allActors, atLeast, wary } from './relations';

/** what the player perceived, and who knew of them, before the turn */
export type OrderWatch = { senses: Set<string>; aware: Set<string>; sneaking: boolean };

const awareOfPlayer = (state: GameState): Set<string> =>
  new Set(allActors(state).filter((x) => x !== state.player && atLeast(x.mind?.knowledge?.[state.player.id]?.status, 'aware')).map((x) => x.id));

export const watchOrder = (state: GameState): OrderWatch =>
  ({ senses: inSenses(state, state.player), aware: awareOfPlayer(state), sneaking: state.player.posture === 'stealthy' });

/** the player's own step came to nothing: wasted, refused, a way found shut, a roll short of Success, a filch gone wrong */
const failed = (e: GameEvent): boolean => e.kind === 'wasted' || e.kind.endsWith('_refused') || !!e.way?.did.startsWith('found_')
  || (!!e.tier && TIERS.pos(e.tier) < TIERS.pos('success')) || (!!e.filch && e.filch !== 'taken');

/** true when the queue stops after this turn; answering: who replied to the player's own words this turn (not news) */
export function orderStops(state: GameState, before: OrderWatch, events: GameEvent[], answering: string[]): boolean {
  const p = state.player;
  const moved = new Set(events.filter((e) => e.kind === 'move' || e.kind === 'arrival').map((e) => e.actorId));
  const ill = (id: string) => { const x = allActors(state).find((a) => a.id === id); return !!x && wary(state, x, p); };
  const hit = contact(p, events)?.by.some((id) => !answering.includes(id));
  // walking up to someone who stands there is the order going as planned; someone arriving, or someone ill-disposed, is news
  const cameIntoView = [...inSenses(state, p)].some((id) => !before.senses.has(id) && (moved.has(id) || ill(id)));
  const seen = [...awareOfPlayer(state)].some((id) => !before.aware.has(id) && (before.sneaking || ill(id)));
  return !!hit || cameIntoView || seen || events.some((e) => e.actorId === p.id && failed(e));
}

/** the steps still queued: the newest narration line's, unless a later order or its question came after it; a / command
 * and its answer pass no time and leave the queue as it is */
export function queuedSteps(lines: readonly LogLine[]): string[] {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (l.kind === 'command' || l.kind === 'notice' || (l.kind === 'player' && l.text.startsWith('/'))) continue;
    return l.kind === 'narration' ? l.queue ?? [] : [];
  }
  return [];
}
