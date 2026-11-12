// Frontiers near the player, re-entry of saved zones (a zone saved on its place page but off the stage).
import type { GameState } from '../types';
import { zoneById } from '../engine/relations';

/** true when a frontier `to` names a zone already built and saved: re-entry loads it, no Weaver call. */
export function isSavedZone(state: GameState, to: string): boolean {
  return !!zoneById(state, to);
}

/** unbuilt frontier keys linked from the player's zone (saved zones are excluded: they load without a Weaver call). */
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
