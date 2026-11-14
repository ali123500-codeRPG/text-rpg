// WZ4 what land the player has made out: from outdoors, each look reveals the cells in sight, out to the sight table's
// farthest glimpse (WZ17: the spec's one sight rule, CONFIG.SIGHT_M, at any light), with hills and whatever stands on
// the land (trees, houses: LandCover.standsM) in the way. The
// cells seen are kept per region on the journal as a bitset, so the map draws only land the character has seen.
import type { GameState, Pt, Region } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { zoneById } from '../engine/relations';
import { heightOf } from '../scenario/heights';
import { coverOf } from './generate';

const cellsOf = (r: Region) => Math.round(r.size / r.cell);
/** the region whose square holds a point in the world's frame */
export function regionAt(state: GameState, p: Pt): Region | undefined {
  const S = CONFIG.REGION_SIZE_M, gx = Math.floor(p.x / S), gy = Math.floor(p.y / S);
  return state.regions?.find((r) => r.gx === gx && r.gy === gy);
}
/** the grid cell of a point in a region, or -1 outside it */
export function cellAt(r: Region, p: Pt): number {
  const N = cellsOf(r), c = Math.floor((p.x - r.gx * r.size) / r.cell), row = Math.floor((p.y - r.gy * r.size) / r.cell);
  return c >= 0 && c < N && row >= 0 && row < N ? row * N + c : -1;
}

const decode = (s: string | undefined, n: number): Uint8Array => {
  const out = new Uint8Array(Math.ceil(n / 8));
  if (s) { const b = atob(s); for (let i = 0; i < b.length && i < out.length; i++) out[i] = b.charCodeAt(i); }
  return out;
};
const encode = (bits: Uint8Array) => btoa(String.fromCharCode(...bits));

/** whether the player has made out each cell of a region (WZ4) */
export function landSeen(state: GameState, regionId: string): (i: number) => boolean {
  const r = state.regions?.find((x) => x.id === regionId);
  if (!r) return () => false;
  const bits = decode(state.player.journal?.landSeen?.[regionId], cellsOf(r) ** 2);
  return (i) => !!(bits[i >> 3] & (1 << (i & 7)));
}

/** the cells of `r` seen from point `p`, an eye `eye` metres above the ground there, out to `range` metres. `world`: every
 * drawn region, so the eye may stand in a neighbour and hills there block the view too (WZ18); by default only `r`. */
export function cellsInSight(r: Region, p: Pt, eye: number, range: number, world: Region[] = [r]): number[] {
  const N = cellsOf(r), C = r.cell, ox = r.gx * r.size, oy = r.gy * r.size;
  const S = r.size, holder = (q: Pt) => world.find((x) => x.gx === Math.floor(q.x / S) && x.gy === Math.floor(q.y / S));
  const own = holder(p), from = own ? cellAt(own, p) : -1;
  if (!own || from < 0) return [];
  const stands = (x: Region, i: number) => getLibrary().landCovers?.[coverOf(x, i)]?.standsM ?? 0;
  const h0 = own.heights[from] + eye;
  const out: number[] = own === r ? [from] : [];
  const cx = Math.floor((p.x - ox) / C), cy = Math.floor((p.y - oy) / C), reach = Math.ceil(range / C);
  for (let row = Math.max(0, cy - reach); row <= Math.min(N - 1, cy + reach); row++) for (let c = Math.max(0, cx - reach); c <= Math.min(N - 1, cx + reach); c++) {
    const i = row * N + c;
    if (own === r && i === from) continue;
    const tx = ox + (c + 0.5) * C, ty = oy + (row + 0.5) * C, d = Math.hypot(tx - p.x, ty - p.y);
    if (d > range) continue;
    // the ground at the target shows over everything between when its slope from the eye is at least the steepest in the way
    const need = (r.heights[i] - h0) / d;
    let clear = true;
    for (let k = 1, steps = Math.floor(d / (C / 2)); k < steps && clear; k++) {
      const t = k / steps, q = { x: p.x + (tx - p.x) * t, y: p.y + (ty - p.y) * t }, x = holder(q);
      const j = x ? cellAt(x, q) : -1;
      if (j < 0 || (x === own && j === from) || (x === r && j === i)) continue;
      if ((x!.heights[j] + stands(x!, j) - h0) / (d * t) > need) clear = false;
    }
    if (clear) out.push(i);
  }
  return out;
}

/** WZ17 how far land is made out: the farthest any visibility level is glimpsed (glaring's 2 km); light only caps how
 * clearly, and land has no partial, so the reach is the same by day and night */
export const landSightM = () => Math.max(...Object.values(CONFIG.SIGHT_M).flatMap((v) => (v ? [v[1]] : [])));

/** WZ4: from outdoors, the player makes out the land around them; the cells join what their journal keeps */
export function seeLand(state: GameState): void {
  const p = state.player, z = zoneById(state, p.zone);
  if (!z?.outdoor || !state.regions?.length) return;
  const at = p.pos ?? (z.rect ? { x: z.rect.x, y: z.rect.y } : undefined);
  if (!at || !regionAt(state, at)) return;
  const range = landSightM(), world = state.regions;
  const j = (p.journal ??= { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
  // WZ18: every drawn region the sight reaches into, the player's own and its neighbours
  for (const r of world.filter((x) => Math.max(x.gx * x.size - at.x, at.x - (x.gx + 1) * x.size, x.gy * x.size - at.y, at.y - (x.gy + 1) * x.size) < range)) {
    const bits = decode(j.landSeen?.[r.id], cellsOf(r) ** 2);
    for (const i of cellsInSight(r, at, CONFIG.LAND_EYE_M + heightOf(z), range, world)) bits[i >> 3] |= 1 << (i & 7);
    (j.landSeen ??= {})[r.id] = encode(bits);
  }
}
