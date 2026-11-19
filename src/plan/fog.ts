// PZ12 a, PZ13: the Map's fog on the floor plan. Each look marks the squares the player sees: 1 m squares under a roof,
// FOG_OPEN_SQUARE_M squares in the open where no land lies under it (over the land, land/sight's cells do it), out to
// FOG_ROOF_M indoors and FOG_OPEN_M in the open. Kept on the journal per floor in chunks of FOG_CHUNK squares a side, one
// bit per square, base64.
import type { GameState, Journal, Pt, Pt3, Zone } from '../types';
import { CONFIG } from '../config';
import { actorBody } from '../library';
import { cellAt, landSeen, regionAt } from '../land/sight';
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
/** a title with more fog squares than this is too big to mark square by square: the Map shows all of it once known */
const FOG_MAX_SQUARES = 4000;
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
  markSquares(state, zones, (z, q, size) => dist(q, eye) <= (size > 1 ? CONFIG.FOG_OPEN_M : CONFIG.FOG_ROOF_M) && lineClear(state, eye, { ...q, z: z.floor + 1 }));
}
/** BG-313: marks every square of `zones` as seen, ground the player already knows whole (the play screen's test stages) */
export const seeWhole = (state: GameState, zones: Zone[]): void => markSquares(state, zones, () => true);

/** sets the fog bit of each square of `zones` (off the land, under FOG_MAX_SQUARES) whose middle `sees` passes */
function markSquares(state: GameState, zones: Zone[], sees: (z: Zone, q: Pt, size: number) => boolean): void {
  const j = (state.player.journal ??= { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
  const chunks = new Map<string, Uint8Array>();
  for (const z of zones) {
    if (!z.outline?.length) continue;
    const size = squareOf(state, z);
    if (size > 1 && regionAt(state, boxOf(z.outline))) continue; // over the land: land/sight's cells
    const b = boxOf(z.outline);
    const i0 = Math.floor((b.x - b.w / 2) / size), i1 = Math.floor((b.x + b.w / 2) / size);
    const j0 = Math.floor((b.y - b.d / 2) / size), j1 = Math.floor((b.y + b.d / 2) / size);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > FOG_MAX_SQUARES) continue; // too big to mark square by square
    for (let i = i0; i <= i1; i++) for (let k = j0; k <= j1; k++) {
      const q = { x: (i + 0.5) * size, y: (k + 0.5) * size };
      if (!inTitle(z, q, size / 2)) continue;
      const s = slot(z.floor, size, q);
      let bits = chunks.get(s.key);
      if (bits && bits[s.bit >> 3] & (1 << (s.bit & 7))) continue;
      if (!sees(z, q, size)) continue;
      if (!bits) { bits = decode(j.seenSquares?.[s.key], CONFIG.FOG_CHUNK ** 2); chunks.set(s.key, bits); }
      bits[s.bit >> 3] |= 1 << (s.bit & 7);
    }
  }
  for (const [k, bits] of chunks) (j.seenSquares ??= {})[k] = encode(bits);
}

/** a stretch of seen squares on one row, in metres (y up): the Map draws a title's floor only under these (BG-313) */
export type SeenRun = { x0: number; x1: number; y0: number; y1: number };
/** PZ12 a, BG-313: the parts of a title the player has seen, as runs along each row of its fog squares, clipped to the
 *  title's box. Over the land (an open title on a region) the land's own cells say what is seen, as seeSquares leaves it */
export function seenRuns(state: GameState, z: Zone): SeenRun[] {
  if (!z.outline?.length) return [];
  const j = state.player.journal, b = boxOf(z.outline), bx0 = b.x - b.w / 2, bx1 = b.x + b.w / 2, by0 = b.y - b.d / 2, by1 = b.y + b.d / 2;
  const size = squareOf(state, z), land = size > 1 ? regionAt(state, b) : undefined, cells = land ? landSeen(state, land.id) : undefined;
  const i0 = Math.floor(bx0 / size), i1 = Math.floor((bx1 - 1e-9) / size), j0 = Math.floor(by0 / size), j1 = Math.floor((by1 - 1e-9) / size);
  const marked = (Math.floor(bx1 / size) - i0 + 1) * (Math.floor(by1 / size) - j0 + 1); // as seeSquares counts them
  if (!land && marked > FOG_MAX_SQUARES) return [{ x0: bx0, x1: bx1, y0: by0, y1: by1 }]; // never marked: all of it
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) return [];
  const seen = (q: Pt) => (land ? cells!(cellAt(land, q)) : seenAt(j, { ...q, floor: z.floor }, size));
  const out: SeenRun[] = [];
  for (let k = j0; k <= j1; k++) {
    const y0 = Math.max(by0, k * size), y1 = Math.min(by1, (k + 1) * size);
    let start: number | null = null;
    for (let i = i0; i <= i1 + 1; i++) {
      const on = i <= i1 && seen({ x: (i + 0.5) * size, y: (k + 0.5) * size });
      if (on && start === null) start = i;
      if (!on && start !== null) { out.push({ x0: Math.max(bx0, start * size), x1: Math.min(bx1, i * size), y0, y1 }); start = null; }
    }
  }
  return out;
}
/** BG-313: the player has seen the point p of title z (the fog square, or over the land the land cell, holding it) */
export const seenIn = (runs: SeenRun[], p: Pt): boolean => runs.some((r) => p.x >= r.x0 - 1e-9 && p.x <= r.x1 + 1e-9 && p.y >= r.y0 - 1e-9 && p.y <= r.y1 + 1e-9);
