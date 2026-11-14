// BG-41: what happened in a scenario, kept on its frame for the Weaver check-in. A judged ending ("the player won a bout
// against Brann") can only be judged from what actually happened, and the check-in sees no events. Code writes one short
// hidden line per notable thing each turn: spars and yields, defeats, gives and trades, quests and deals. The newest
// CONFIG.SCENARIO_HAPPENED_MAX (placeholder) are kept.
import type { Actor, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { actorById, allActors } from './relations';
import { itemDef } from '../library';

const who = (state: GameState, id: string | undefined): string => (id === state.player.id ? 'the player' : (id && actorById(state, id)?.names.current) || 'someone');
function itemOf(state: GameState, inst: string | undefined): string {
  for (const a of allActors(state)) {
    const i = a.core.inventory.find((x) => x.id === inst);
    if (i) { try { return itemDef(state, i.itemId).name; } catch { return i.itemId; } }
  }
  return 'something';
}

/** this turn's notable happenings, in words */
export function happenedLines(state: GameState, events: GameEvent[], defeated: Actor[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.kind === 'give') out.push(`${who(state, e.actorId)} gave ${who(state, e.target)} ${itemOf(state, e.itemId)}`);
    else if (e.kind === 'take') out.push(`${who(state, e.actorId)} took ${itemOf(state, e.itemId)} from ${who(state, e.target)}`); // BF34
    else if (e.kind === 'buy' || e.kind === 'sell') out.push(`${who(state, e.actorId)} ${e.kind === 'buy' ? 'bought' : 'sold'} ${e.itemId ? itemOf(state, e.itemId) : 'a service'} ${e.kind === 'buy' ? 'from' : 'to'} ${who(state, e.target)}`);
  }
  for (const a of defeated) out.push(`the player defeated ${who(state, a.id)}`);
  for (const l of state.log.filter((x) => x.turn === state.turn)) {
    const d = (l.detail ?? {}) as Record<string, unknown>;
    const names = (ids: unknown) => (Array.isArray(ids) ? ids.map((x) => who(state, String(x))).join(', ') : '');
    switch (l.code) {
      case 'spar_out': out.push(`${who(state, String(d.actorId))} ${d.reason === 'yielded' ? 'yielded in the spar' : 'was beaten in the spar'}`); break;
      case 'spar_ended': out.push(`the spar ended${names(d.winners) ? `: won by ${names(d.winners)}` : ''}`); break;
      case 'player_yielded': out.push('the player yielded'); break;
      case 'yield_accepted': out.push(d.by ? `${who(state, String(d.by))} yielded to ${who(state, String(d.actorId))}` : `${who(state, String(d.actorId))} accepted the player's yield`); break;
      case 'stood_down': out.push(`${who(state, String(d.actorId))} stood down from ${who(state, String(d.from))}${names(d.with) ? `, with ${names(d.with)}` : ''}`); break; // TF16
      case 'yield_refused': out.push(`${who(state, String(d.actorId))} refused the player's yield`); break;
      case 'quest_made': case 'quest_ready': case 'quest_ended': {
        const q = state.quests.find((x) => x.id === d.id);
        if (q) out.push(`job "${q.text}": ${l.code === 'quest_made' ? 'taken on' : l.code === 'quest_ready' ? 'goal reached' : String(d.state)}`);
        break;
      }
      case 'agreement_made': out.push(`deal made between ${names(d.parties)}`); break;
      case 'player_fell': out.push('the player went down'); break;
      case 'player_spared': out.push('the player was spared'); break;
    }
  }
  return out;
}

/** after each turn: add this turn's lines to the running scenario (and the bigger one it sits in), or in free roam (SW3 a)
 * to the roam, with the player's attacks too, since one of them may start the next scenario */
export function noteHappened(state: GameState, events: GameEvent[], defeated: Actor[]): void {
  const p = state.player.id, roam = state.stage.roam && !state.stage.scenario ? state.stage.roam : undefined;
  const attacks = roam ? events.filter((e) => e.kind === 'attack' && (e.actorId === p || e.target === p)).map((e) => `${who(state, e.actorId)} attacked ${who(state, e.target)}`) : [];
  const lines = [...new Set(attacks), ...happenedLines(state, events, defeated)];
  if (!lines.length) return;
  for (const f of [state.stage.scenario, state.stage.outer, roam]) {
    if (!f) continue;
    const list = (f.happened ??= []);
    list.push(...lines.map((text) => ({ turn: state.turn, text })));
    if (list.length > CONFIG.SCENARIO_HAPPENED_MAX) list.splice(0, list.length - CONFIG.SCENARIO_HAPPENED_MAX);
  }
}
