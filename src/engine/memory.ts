// PM1–PM4: an NPC's memory list and the agreements between actors. Agent outputs are requests;
// code keeps the list to CONFIG.MEMORY_ENTRIES and records a deal only when the other party heard it said this turn.
import type { Actor, AgreementEnd, AgreementMade, GameState, MemoryOps } from '../types';
import { CONFIG } from '../config';
import { actorById, isActive } from './relations';
import { tally } from './xp';
import { freshId } from '../ids';

const logCode = (state: GameState, code: string, detail: Record<string, unknown>) => state.log.push({ turn: state.turn, code, detail });

/** drop by number (as the view numbers them, from 1), then add; past the limit the oldest go (PM2) */
export function applyMemoryOps(state: GameState, a: Actor, ops: MemoryOps | null | undefined, note?: string): void {
  const adds = [...(ops?.add ?? []), ...(note ? [note] : [])].map((t) => t.trim()).filter(Boolean);
  const drop = new Set(ops?.drop ?? []);
  if (!adds.length && !drop.size) return;
  const cur = state.hidden.memory[a.id] ?? [];
  for (const n of drop) if (!Number.isInteger(n) || n < 1 || n > cur.length) logCode(state, 'invalid_memory_drop', { actorId: a.id, n });
  const next = [...cur.filter((_, i) => !drop.has(i + 1)), ...adds.map((text) => ({ turn: state.turn, text }))];
  const over = next.length - CONFIG.MEMORY_ENTRIES;
  if (over > 0) logCode(state, 'memory_full', { actorId: a.id, dropped: next.slice(0, over).map((m) => m.text) });
  const kept = next.slice(Math.max(0, over));
  if (kept.length) state.hidden.memory[a.id] = kept;
  else delete state.hidden.memory[a.id];
}

/** the deals `id` is a party to */
export const agreementsOf = (state: GameState, id: string) => (state.hidden.agreements ?? []).filter((g) => g.parties.includes(id));

/** PM3/PM4: a deal with the player or another NPC, recorded only when the other party heard the maker speak this turn */
export function makeAgreement(state: GameState, a: Actor, made: AgreementMade, heardNow: (listener: string, speaker: string) => boolean): string | undefined {
  const other = actorById(state, made.with);
  const text = made.text.trim();
  if (!other || other.id === a.id || !isActive(other) || !text || !heardNow(other.id, a.id)) {
    logCode(state, 'invalid_agreement', { actorId: a.id, with: made.with });
    return undefined;
  }
  const list = (state.hidden.agreements ??= []);
  const id = freshId(`deal_${state.turn}_${a.id}`, new Set(list.map((g) => g.id)));
  list.push({ id, parties: [a.id, other.id], text, madeTurn: state.turn, madeBy: a.id });
  logCode(state, 'agreement_made', { id, parties: [a.id, other.id] });
  if (a === state.player || other === state.player) tally(state, 'deals');
  return id;
}

/** a party ends its own deal as done or broken (not one that holds a quest) */
export function endAgreements(state: GameState, a: Actor, ends: AgreementEnd[] | undefined): void {
  for (const e of ends ?? []) {
    const g = state.hidden.agreements?.find((x) => x.id === e.id && x.parties.includes(a.id));
    if (!g) { logCode(state, 'invalid_agreement_end', { actorId: a.id, id: e.id }); continue; }
    // QT22: a deal that holds a quest is locked; only code ends it, with the quest
    if (state.quests.some((q) => q.dealId === g.id)) { logCode(state, 'quest_deal_locked', { actorId: a.id, id: e.id }); continue; }
    state.hidden.agreements = state.hidden.agreements!.filter((x) => x !== g);
    logCode(state, 'agreement_ended', { id: g.id, outcome: e.outcome, by: a.id });
  }
}
