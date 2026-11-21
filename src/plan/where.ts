// PZ1 a: where a point is: its title (the smallest space that holds it), whether it is indoors (a roof overhead), and the
// ways out of a title (the openings that join it, read from its side).
import type { GameState, Opening, Pt, Zone } from '../types';
import { areaOf, boxOf, inOutline, middleOf, nearestEdge } from './geom';
import { CONFIG } from '../config';

/** a title's space in m³ (its footprint's area × its height): the smaller wins where spaces overlap */
const volumeOf = (z: Zone) => Math.max(areaOf(z.outline), 1e-6) * Math.max(z.top - z.floor, 1e-6);
/** height `h` is in the title's space: from its floor up to (not including) its top */
const inSpan = (z: Zone, h: number) => h >= z.floor - 0.01 && h < z.top - 0.01;

/** the box round each title's outline, kept per outline array */
const boxes = new WeakMap<object, { x0: number; x1: number; y0: number; y1: number }>();
function boxFor(z: Zone) {
  let b = boxes.get(z.outline);
  if (!b) { const r = boxOf(z.outline); b = { x0: r.x - r.w / 2, x1: r.x + r.w / 2, y0: r.y - r.d / 2, y1: r.y + r.d / 2 }; boxes.set(z.outline, b); }
  return b;
}
/** the point lies in the title's footprint (its edge counts as in) */
/** how near a title's edge a point counts as on it (inTitle's tolerance) */
const EDGE_EPS_M = 0.01;
export function inTitle(z: Zone, p: Pt, eps = EDGE_EPS_M): boolean {
  if (!z.outline?.length) return false;
  const b = boxFor(z);
  return p.x >= b.x0 - eps && p.x <= b.x1 + eps && p.y >= b.y0 - eps && p.y <= b.y1 + eps && inOutline(p, z.outline, eps);
}
/** the point lies in the title's space at height `floor` (metres above the ground outside) */
export const inSpace = (z: Zone, p: Pt, floor: number): boolean => inSpan(z, floor) && inTitle(z, p);

/** PZ1 a: the title of a point on a floor: the smallest space that holds it; `prefer` (the title it was in) breaks a tie.
 * BG-1506: a point on a wall the title it was in shares with another (a doorway) stays in the title it was in */
export function zoneAt(state: GameState, p: Pt, floor: number, prefer?: string): Zone | undefined {
  let best: Zone | undefined, bv = Infinity;
  const was = prefer ? state.zones.find((z) => z.id === prefer && inSpace(z, p, floor)) : undefined;
  for (const z of state.zones) {
    if (!inSpace(z, p, floor)) continue;
    if (was && z !== was && nearestEdge(p, z.outline).d <= EDGE_EPS_M) continue;
    const v = volumeOf(z);
    if (v < bv - 1e-6 || (Math.abs(v - bv) <= 1e-6 && z.id === prefer)) { best = z; bv = v; }
  }
  return best;
}

/** a title's middle (where a walk to it heads, and where placing starts) */
export const middle = (z: Zone): Pt => middleOf(z.outline);

/** PZ5: a roof is overhead at a point on a floor (indoors) */
export function underRoof(state: GameState, p: Pt, floor: number): boolean {
  return state.roofs.some((r) => r.h > floor + 0.01 && inOutline(p, r.outline));
}
/** PZ5: a title is under a roof (judged at its middle): the title of an indoor space */
export const roofed = (state: GameState, z: Zone | undefined): boolean => !!z && underRoof(state, middle(z), z.floor);
/** the title's top for its kind of space: a storey under a roof, OPEN_AIR_TOP_M in the open */
export const topFor = (floor: number, roof: boolean): number => floor + (roof ? CONFIG.STOREY_HEIGHT : CONFIG.OPEN_AIR_TOP_M);

/** a way out of a title, read from its side: the opening, the title (or frontier key) it leads to and its label */
export type Way = { to: string; label: string; opening: Opening; frontier?: true; drop?: true; barrier?: string };
/** the side of an opening a title is on (0 or 1), or −1 when it does not join it */
export const sideOfOpening = (o: Opening, zoneId: string): number => (o.joins[0] === zoneId ? 0 : o.joins[1] === zoneId && !o.frontier ? 1 : -1);
/** an opening read from one of its titles */
export function wayFrom(o: Opening, zoneId: string): Way | undefined {
  const i = sideOfOpening(o, zoneId);
  if (i < 0) return undefined;
  return { to: o.joins[1 - i], label: o.labels[i], opening: o, ...(o.frontier ? { frontier: true as const } : {}), ...(o.drop && i === 0 ? { drop: true as const } : {}), ...(o.barrier ? { barrier: o.barrier } : {}) };
}
/** PZ2: the ways out of a title: every opening that joins it, read from its side (a drop only from above) */
export function waysOut(state: GameState, zoneId: string): Way[] {
  const out: Way[] = [];
  for (const o of state.openings) {
    const w = wayFrom(o, zoneId);
    if (w && !(o.drop && sideOfOpening(o, zoneId) === 1)) out.push(w);
  }
  return out;
}
/** the way from one title to another (or to a frontier key), if there is one */
export const wayTo = (state: GameState, zoneId: string, to: string): Way | undefined => waysOut(state, zoneId).find((w) => w.to === to);
/** the opening by id */
export const openingById = (state: GameState, id: string): Opening | undefined => state.openings.find((o) => o.id === id);
