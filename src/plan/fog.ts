// PZ12 a, PZ13: the Map's fog on the floor plan. Each look marks the squares the player sees: 1 m squares under a roof,
// FOG_OPEN_SQUARE_M squares in the open where no land lies under it (over the land, land/sight's cells do it), out to
// FOG_ROOF_M indoors and FOG_OPEN_M in the open. Kept on the journal per floor in chunks of FOG_CHUNK squares a side, one
// bit per square, base64.
import type { GameState, Journal, Pt, Pt3, Zone } from '../types';
import { CONFIG } from '../config';
import { actorBody } from '../library';
import { regionAt } from '../land/sight';
import { boxOf, dist } from './geom';
import { inTitle, roofed } from './where';
import { lineClear } from './line';

const decode = (s: string | undefined, n: number): Uint8Array => {
  const out = new Uint8Array(Math.ceil(n / 8));
  if (s) { const b = atob(s); for (let i = 0; i < b.length && i < out.length; i++) out[i] = b.charCodeAt(i); }
  return out;
};
const encode = (bits: Uint8Array) => btoa(String.fromCharCode(...bits));
const fl = (f: number) => Math.round(f * 100) / 100;
/** the size of the fog's squares at a title: 1 m under a roof, FOG_OPEN_SQUARE_M in the open */
export const squareOf = (state: GameState, z: Zone): number => (roofed(state, z) ? 1 : CONFIG.FOG_OPEN_SQUARE_M);
/** the chunk key and bit of the square holding p */
function slot(floor: number, size: number, p: Pt): { key: string; bit: number } {
  const N = CONFIG.FOG_CHUNK, i = Math.floor(p.x / size), j = Math.floor(p.y / size);
  const cx = Math.floor(i / N), cy = Math.floor(j / N);
  return { key: `${fl(floor)}:${size}:${cx}:${cy}`, bit: (j - cy * N) * N + (i - cx * N) };
}
/** PZ12: the player has seen the square holding p on its floor (at the fog's square size `size`) */
export function seenAt(j: Journal | undefined, p: Pt3, size: number): boolean {
  const s = slot(p.floor, size, p), raw = j?.seenSquares?.[s.key];
  if (!raw) return false;
  const bits = decode(raw, CONFIG.FOG_CHUNK ** 2);
  return !!(bits[s.bit >> 3] & (1 << (s.bit & 7)));
}
/** PZ12: marks the squares of `zones` the player sees from where it stands now (a line from its eye to each square's
 * middle, a metre above its floor) */
export function seeSquares(state: GameState, zones: Zone[]): void {
  const p = state.player, here = zones.find((z) => z.id === p.zone);
  if (!p.pos || !here) return;
  const eye = { x: p.pos.x, y: p.pos.y, z: here.floor + actorBody(state, p).size.heightM * CONFIG.EYE_SHARE };
  const j = (p.journal ??= { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
  const chunks = new Map<string, Uint8Array>();
  for (const z of zones) {
    if (!z.outline?.length) continue;
    const size = squareOf(state, z);
    if (size > 1 && regionAt(state, boxOf(z.outline))) continue; // over the land: land/sight's cells
    const reach = size > 1 ? CONFIG.FOG_OPEN_M : CONFIG.FOG_ROOF_M;
    const b = boxOf(z.outline);
    const i0 = Math.floor((b.x - b.w / 2) / size), i1 = Math.floor((b.x + b.w / 2) / size);
    const j0 = Math.floor((b.y - b.d / 2) / size), j1 = Math.floor((b.y + b.d / 2) / size);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4000) continue; // too big to mark square by square
    for (let i = i0; i <= i1; i++) for (let k = j0; k <= j1; k++) {
      const q = { x: (i + 0.5) * size, y: (k + 0.5) * size };
      if (!inTitle(z, q, size / 2) || dist(q, eye) > reach) continue;
      const s = slot(z.floor, size, q);
      let bits = chunks.get(s.key);
      if (bits && bits[s.bit >> 3] & (1 << (s.bit & 7))) continue;
      if (!lineClear(state, eye, { ...q, z: z.floor + 1 })) continue;
      if (!bits) { bits = decode(j.seenSquares?.[s.key], CONFIG.FOG_CHUNK ** 2); chunks.set(s.key, bits); }
      bits[s.bit >> 3] |= 1 << (s.bit & 7);
    }
  }
  for (const [k, bits] of chunks) (j.seenSquares ??= {})[k] = encode(bits);
}
