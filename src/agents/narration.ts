// Narrator leak scan, fact check and the templated fallback narration (D-23: plain templates until decided).
// The scan itself is code and may read GameState; nothing here is ever sent to an agent.
import type { GameState, NarrationEvent, NarrationView, NarratorOutput } from '../types';
import { getLibrary, itemDef } from '../library';
import { knowsName } from '../engine/relations';

/** what must not appear in the text unless the view itself holds it */
export type LeakContext = {
  terms: string[]; // leakTerms of unrevealed secrets + the active stage's hiddenTerms
  names: string[]; // names of actors not in namesKnown, names of items outside the player's own gear
  ids: string[]; // actor, zone, item instance and secret ids
};

export function buildLeakContext(state: GameState): LeakContext {
  const known = new Set(state.player.journal?.secretsKnown ?? []);
  const terms = [
    ...state.hidden.secrets.filter((s) => !known.has(s.id)).flatMap((s) => s.leakTerms),
    ...state.hidden.stage.hiddenTerms,
  ];
  const names: string[] = [];
  for (const a of state.actors) {
    if (!knowsName(state, state.player, a)) names.push(a.names.current, ...a.names.past.map((p) => p.name));
  }
  const itemName = (itemId: string) => {
    try {
      return itemDef(state, itemId).name;
    } catch {
      return null;
    }
  };
  const ownNames = new Set(state.player.core.inventory.map((i) => itemName(i.itemId)));
  // BG-168: only a name that tells which thing it is (a story-made item, a Threadbound one) is a leak; a catalog item's name
  // is an everyday noun (a sack, a chest) the Narrator may use for anything
  const telling = (itemId: string) => state.blueprints?.some((b) => b.kind === 'item' && b.id === itemId) || !!getLibrary().items[itemId]?.threadbound;
  for (const i of [...state.actors.flatMap((a) => a.core.inventory), ...state.zones.flatMap((z) => z.groundItems)]) {
    const n = telling(i.itemId) ? itemName(i.itemId) : null;
    if (n && !ownNames.has(n)) names.push(n);
  }
  const ids = [
    ...state.actors.map((a) => a.id),
    ...state.zones.map((z) => z.id),
    ...state.actors.flatMap((a) => a.core.inventory.map((i) => i.id)),
    ...state.player.core.inventory.map((i) => i.id),
    ...state.hidden.secrets.map((s) => s.id),
  ];
  return { terms: uniq(terms), names: uniq(names), ids: uniq(ids) };
}

export { mentions } from '../words';
import { mentions, cap } from '../words';
const uniq = (xs: string[]) => [...new Set(xs.filter((x) => x && x.trim()))];
/** every forbidden name, id or term found in `text` that the view (or other allowed text) does not itself hold */
export function leakScan(text: string, allowedText: string, ctx: LeakContext): string[] {
  const hits: string[] = [];
  for (const [kind, list] of [['term', ctx.terms], ['name', ctx.names], ['id', ctx.ids]] as const) {
    for (const x of list) if (mentions(text, x) && !mentions(allowedText, x)) hits.push(`${kind}:${x}`);
  }
  return hits;
}

const POSITION = new Set(['move', 'arrival', 'flee', 'sneak']);
const INVENTORY = new Set(['give', 'buy', 'buy_refused', 'sell', 'sell_refused', 'pick_up', 'summon', 'item_dropped', 'gear', 'equip', 'use_item', 'thrown', 'stolen', 'open', 'break_open', 'filch', 'set_down', 'put_in']);

/** full events that must be narrated: presence, and anything changing the player's condition, inventory or position */
export function mustNarrate(e: NarrationEvent, view: NarrationView): boolean {
  if (e.level !== 'full') return false;
  if (e.kind === 'presence' || e.kind === 'arrival') return true;
  const isPlayer = (x?: string) => x === 'player' || x === view.player.name;
  const byPlayer = isPlayer(e.actor) || isPlayer(e.packet?.actor);
  const onPlayer = isPlayer(e.target) || isPlayer(e.packet?.target);
  if (byPlayer && POSITION.has(e.kind)) return true;
  if ((byPlayer || onPlayer) && (e.kind === 'stand_down' || e.kind === 'surrender')) return true; // TF16, TF19
  if ((byPlayer || onPlayer) && INVENTORY.has(e.kind)) return true;
  if (onPlayer && ((e.changes?.length ?? 0) > 0 || (e.packet?.changes.length ?? 0) > 0)) return true;
  return false;
}

/** narrated ids must be in the view; required events must be listed */
export function factCheck(out: NarratorOutput, view: NarrationView): string[] {
  const ids = new Set(view.events.map((e) => e.id));
  const errs = out.narrated.filter((id) => !ids.has(id)).map((id) => `unknown_event:${id}`);
  const listed = new Set(out.narrated);
  for (const e of view.events) if (mustNarrate(e, view) && !listed.has(e.id)) errs.push(`missing_event:${e.id}`);
  return errs;
}

// ---------------- fallback narration ----------------

const who = (x?: string) => (!x ? 'someone' : x === 'player' ? 'you' : x);
const SAYS = { whisper: 'whispers', normal: 'says', shout: 'shouts' } as const;
const PARTIAL: Record<string, string> = {
  sound: 'You hear something',
  sight: 'You glimpse movement',
  smell: 'You catch a smell',
  touch: 'You feel something',
};

function eventLine(e: NarrationEvent): string {
  if (e.level === 'partial') return `${PARTIAL[e.cue] ?? 'Something stirs'}${e.where ? ` ${e.where}` : ''}.`;
  if (e.line) {
    const speaker = e.line.speaker ?? e.actor;
    const verb = speaker === 'player' ? SAYS[e.line.volume].replace(/s$/, '') : SAYS[e.line.volume]; // "you say", not "you says"
    return `${cap(who(speaker))} ${verb}: "${e.line.text}"`;
  }
  if (e.packet) {
    const p = e.packet;
    const loc = p.location ? ` (${p.location.part})` : '';
    const ch = p.changes.length ? ` ${p.changes.join('; ')}.` : '';
    return `${cap(who(p.actor))} ${p.action.replace(/_/g, ' ')}${p.actor === 'player' ? '' : 's'} ${who(p.target)}: ${p.outcome.replace(/_/g, ' ')}${loc}.${ch}`;
  }
  switch (e.kind) {
    case 'presence':
      return `${cap(who(e.actor))} is here${e.activityLook ? `, ${e.activityLook}` : ''}.`;
    case 'arrival':
      return `${cap(who(e.actor))} ${e.actor === 'player' ? 'arrive' : 'arrives'}${e.where ? ` at ${e.where}` : ''}.`;
    case 'busy':
      return `${cap(who(e.actor))} ${e.actor === 'player' ? 'keep' : 'keeps'} at it${e.busy ? `: ${e.busy.doing.toLowerCase()}, ${e.busy.left} s to go` : ''}${e.item ? ` (${e.item})` : ''}.`;
    case 'move':
      return `${cap(who(e.actor))} ${e.actor === 'player' ? 'move' : 'moves'}${e.spot ? ` ${e.spot}` : e.heading ? ` toward ${e.heading}` : e.from && e.where ? ` from ${e.from} to ${e.where}` : e.within && e.where ? ` within ${e.where}` : e.where ? ` to ${e.where}` : ''}.`;
  }
  const changes = e.changes?.length ? `: ${e.changes.join('; ')}` : '';
  return `${cap(who(e.actor))} ${e.kind.replace(/_/g, ' ')}${e.target ? ` ${who(e.target)}` : ''}${e.item ? ` (${e.item})` : ''}${changes}.`;
}

/** plain template text from the view only, so it can never leak */
export function fallbackNarration(view: NarrationView): NarratorOutput {
  const lines = view.events.map(eventLine);
  const here = view.surroundings.find((z) => z.id === view.player.zone) ?? view.surroundings[0];
  if (here) lines.push(`You are in ${here.name}.`);
  return { text: lines.join(' '), narrated: view.events.map((e) => e.id) };
}
