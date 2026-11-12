// Stage trim [Proposed], frontiers near the player, re-entry of saved zones.
import type { GameState } from '../types';
import { CONFIG } from '../config';
import { isEngaged, zoneById } from '../engine/relations';

/** true when a frontier `to` names a zone already built and saved (a trimmed zone): re-entry loads it, no Weaver call. */
export function isSavedZone(state: GameState, to: string): boolean {
  return !!zoneById(state, to);
}

/** unbuilt frontier keys linked from the player's zone (trimmed zones are excluded: they load without a Weaver call). */
export function frontiersNearPlayer(state: GameState): string[] {
  const z = zoneById(state, state.player.zone);
  const out: string[] = [];
  for (const l of z?.links ?? []) if (l.frontier && !isSavedZone(state, l.to) && !out.includes(l.to)) out.push(l.to);
  return out;
}

/** re-enter a saved zone through a frontier link: back on the stage, links into it lose the frontier mark, its links to off-stage zones become frontiers. */
export function loadSavedZone(state: GameState, zoneId: string): void {
  const z = zoneById(state, zoneId);
  if (!z) return;
  if (!state.stage.zoneIds.includes(z.id)) state.stage.zoneIds.push(z.id);
  if (!state.zones.includes(z)) state.zones.push(z);
  const stage = new Set(state.stage.zoneIds);
  for (const s of state.zones) for (const l of s.links) if (l.to === z.id) delete l.frontier;
  for (const l of z.links) {
    if (stage.has(l.to)) delete l.frontier;
    else l.frontier = true;
  }
}

export function trimStage(state: GameState): void {
  const max = CONFIG.MAX_STAGE_ZONES;
  if (state.stage.zoneIds.length <= max) return;
  const stage = new Set(state.stage.zoneIds);
  // distance from the player over stage links (both ways); unreachable zones count as farthest
  const dist = new Map<string, number>([[state.player.zone, 0]]);
  const q = [state.player.zone];
  while (q.length) {
    const cur = q.shift()!;
    const next = new Set<string>();
    for (const l of zoneById(state, cur)?.links ?? []) if (!l.frontier) next.add(l.to);
    for (const s of state.zones) if (s.links.some((l) => l.to === cur && !l.frontier)) next.add(s.id);
    for (const n of next) if (stage.has(n) && !dist.has(n)) (dist.set(n, dist.get(cur)! + 1), q.push(n));
  }
  const engagedZones = new Set(state.actors.filter((a) => isEngaged(state, a)).map((a) => a.zone));
  const candidates = state.stage.zoneIds
    .filter((id) => id !== state.player.zone && !engagedZones.has(id))
    .sort((a, b) => (dist.get(b) ?? Infinity) - (dist.get(a) ?? Infinity) || (a < b ? -1 : a > b ? 1 : 0));
  const drop = new Set(candidates.slice(0, state.stage.zoneIds.length - max));
  if (!drop.size) return;
  state.stage.zoneIds = state.stage.zoneIds.filter((id) => !drop.has(id));
  state.zones = state.zones.filter((z) => !drop.has(z.id));
  for (const z of state.zones) for (const l of z.links) if (drop.has(l.to)) l.frontier = true;
  // GAP: actors standing in dropped zones stay in state.actors (D-46 covers routines cut off by a trim).
}
