// MAP-12, MAP-13: a building's ground as one shape, shared by the map's drawn outline, its checker (checkStage) and zone
// placement (placeZones, brokenLayouts), so all three read the same shape (RM5 a, RM19 b, RM21 a). Boxes are in screen
// pixels at zoom 1 (y down).
import type { Rect } from '../types';

/** screen pixels per metre before zoom; the scale bar is drawn from it too (MAP-10) */
export const PX_PER_M = 12;
export type Box = { x0: number; y0: number; x1: number; y1: number };
const hit = (a: Box, b: Box, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
/** a rectangle in metres (y north) as a box in screen pixels at zoom 1 (y down) */
export const pxBox = (r: Rect): Box => ({ x0: (r.x - r.w / 2) * PX_PER_M, y0: -(r.y + r.d / 2) * PX_PER_M, x1: (r.x + r.w / 2) * PX_PER_M, y1: -(r.y - r.d / 2) * PX_PER_M });

/** a place's padding round its own ground, in screen pixels: wider for an outer place, so an inner one sits inside it */
export const placePad = (depth: number) => 6 + 4 * Math.max(0, 3 - depth);
/** MAP-13: a place's footprint, its own ground: each box of `own` padded by `pad`, joined, less any part over `others` (the
 *  zones of somewhere else), as the cells of the grid their sides make; on[j][i] is the cell in row j, column i */
export type Footprint = { xs: number[]; ys: number[]; on: boolean[][] };
export function footprint(own: Box[], others: Box[], pad: number): Footprint {
  const grown = own.map((b) => ({ x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }));
  const near = others.filter((o) => grown.some((g) => hit(g, o)));
  const lines = (a: 'x0' | 'y0', b: 'x1' | 'y1') => [...new Set([...grown, ...near].flatMap((q) => [q[a], q[b]]))].sort((u, v) => u - v);
  const xs = lines('x0', 'x1'), ys = lines('y0', 'y1');
  const pt = (x: number, y: number, q: Box) => x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1;
  const on = ys.slice(1).map((_, j) => xs.slice(1).map((__, i) => {
    const x = (xs[i] + xs[i + 1]) / 2, y = (ys[j] + ys[j + 1]) / 2;
    return grown.some((q) => pt(x, y, q)) && !near.some((q) => pt(x, y, q));
  }));
  return { xs, ys, on };
}
const cellBox = (f: Footprint, i: number, j: number): Box => ({ x0: f.xs[i], y0: f.ys[j], x1: f.xs[i + 1], y1: f.ys[j + 1] });
export const cellsOf = (f: Footprint): Box[] => f.on.flatMap((row, j) => row.flatMap((c, i) => (c ? [cellBox(f, i, j)] : [])));
/** the footprint's cells numbered by the piece each belongs to (cells that touch along a side are one piece; -1: off) */
function piecesOf(f: Footprint): { n: number; of: number[][] } {
  const of = f.on.map((row) => row.map(() => -1));
  let n = 0;
  f.on.forEach((row, j) => row.forEach((c, i) => {
    if (!c || of[j][i] >= 0) return;
    const todo = [[i, j]];
    of[j][i] = n;
    while (todo.length) {
      const [a, b] = todo.pop()!;
      for (const [x, y] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) if (f.on[y]?.[x] && of[y][x] < 0) { of[y][x] = n; todo.push([x, y]); }
    }
    n++;
  }));
  return { n, of };
}

/** MAP-12 on a building's whole indoor ground (`inner`, as its footprint at a place `depth` deep): the zones of somewhere
 *  else (`others`) that run through it, over a room or cutting the footprint in two, and how many pieces it is in */
export function buildingCheck(inner: Box[], others: { id: string; b: Box }[], depth: number): { through: Set<string>; pieces: number } {
  const fp = footprint(inner, others.map((o) => o.b), placePad(depth)), parts = piecesOf(fp);
  const through = new Set<string>();
  for (const { id, b } of others) {
    if (inner.some((q) => hit(b, { x0: q.x0 + 0.5, y0: q.y0 + 0.5, x1: q.x1 - 0.5, y1: q.y1 - 0.5 }))) through.add(id);
    // a zone that touches two pieces of the footprint cuts the building in two
    const touched = new Set(fp.on.flatMap((row, j) => row.flatMap((c, i) => (c && hit(b, cellBox(fp, i, j), 1) ? [parts.of[j][i]] : []))));
    if (touched.size > 1) through.add(id);
  }
  return { through, pieces: parts.n };
}
