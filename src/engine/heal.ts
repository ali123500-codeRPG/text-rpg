// Healing (Ali, 07/11/2026, "Healing: options" H1–H11). Every source is a row of the library healing table, applied by
// this one rule, so amounts stay consistent (B5) and new sources or tiers are new rows (H1).
import type { Actor, GameState } from '../types';
import { getLibrary } from '../library';
import { healthLevel, partStates } from '../ruleset';
import { logCode } from './effects';

export const healingName = (id: string) => getLibrary().healing?.[id]?.name ?? id;

/** Restores the row's share of HP and of each part pool. Parts at 0% or lower (Crippled) heal only from a source that
 * fixes them, and then start from 0 (H4). Destroyed parts never come back here (OQ-6). Returns false if nothing changed. */
export function applyHealing(state: GameState, a: Actor, sourceId: string): boolean {
  const src = getLibrary().healing?.[sourceId];
  if (!src) return false;
  const c = a.core.condition;
  const level = healthLevel(a);
  const before = partStates(state, a);
  const lost = c.hpLostPct;
  c.hpLostPct = Math.max(0, lost - src.hpPct);
  const changed: { id: string; from: string; to: string }[] = [];
  for (const p of before) {
    if (p.state === 'Destroyed' || !(p.id in c.parts)) continue;
    const pct = c.parts[p.id];
    if (pct <= 0 && !src.fixesCrippled) continue;
    c.parts[p.id] = Math.min(100, Math.max(0, pct) + src.partPct);
  }
  for (const p of partStates(state, a)) {
    const was = before.find((b) => b.id === p.id)!.state;
    if (was !== p.state) changed.push({ id: p.id, from: was, to: p.state });
  }
  logCode(state, 'healed', { actorId: a.id, source: sourceId, from: level, to: healthLevel(a), parts: changed });
  return c.hpLostPct !== lost || changed.length > 0;
}
