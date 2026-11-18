// PZ1, PZ2: plane geometry for titles' outlines and the floor plan, in metres (x east, y north).
import type { Pt, Rect } from '../types';

export const GEO_EPS = 1e-6;
/** metres closer than this count as the same spot */
export const NEAR_M = 0.01;

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const crossOf = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** a rectangle's corners, counter-clockwise from the south-west */
export const rectOutline = (r: Rect): Pt[] => [
  { x: r.x - r.w / 2, y: r.y - r.d / 2 }, { x: r.x + r.w / 2, y: r.y - r.d / 2 },
  { x: r.x + r.w / 2, y: r.y + r.d / 2 }, { x: r.x - r.w / 2, y: r.y + r.d / 2 },
];
/** the box round an outline, as a Rect */
export function boxOf(pts: Pt[]): Rect {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0 };
}
/** an outline's area in m² (corners in either turn) */
export function areaOf(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
}
/** an outline's middle: its centroid (the box's centre for a degenerate one) */
export function middleOf(pts: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], c = p.x * q.y - q.x * p.y;
    a += c; cx += (p.x + q.x) * c; cy += (p.y + q.y) * c;
  }
  if (Math.abs(a) < GEO_EPS) { const b = boxOf(pts); return { x: b.x, y: b.y }; }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
/** the outline's sides, each from one corner to the next */
export const sidesOf = (pts: Pt[]): [Pt, Pt][] => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);

/** metres from p to the segment a–b, and the share t along it of the nearest point */
export function toSegment(p: Pt, a: Pt, b: Pt): { d: number; t: number; at: Pt } {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  const at = { x: a.x + t * dx, y: a.y + t * dy };
  return { d: dist(p, at), t, at };
}
/** p lies in the outline, its edge (within eps) counting as in */
export function inOutline(p: Pt, pts: Pt[], eps = NEAR_M): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (toSegment(p, a, b).d <= eps) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** the nearest point of the outline's edge to p */
export function nearestEdge(p: Pt, pts: Pt[]): { at: Pt; d: number; side: number } {
  let best = { at: pts[0], d: Infinity, side: 0 };
  sidesOf(pts).forEach(([a, b], i) => { const s = toSegment(p, a, b); if (s.d < best.d) best = { at: s.at, d: s.d, side: i }; });
  return best;
}
/** p kept inside the outline: itself when in, else the nearest edge point moved `inset` metres toward the middle */
export function keepInside(p: Pt, pts: Pt[], inset = 0): Pt {
  if (inOutline(p, pts, 0) && (inset <= 0 || nearestEdge(p, pts).d >= inset - GEO_EPS)) return p;
  const e = nearestEdge(p, pts).at, m = middleOf(pts), d = dist(e, m);
  if (d <= GEO_EPS) return m;
  const k = Math.min(inset, d) / d;
  return { x: e.x + (m.x - e.x) * k, y: e.y + (m.y - e.y) * k };
}

/** where segment p–q crosses segment a–b: the shares along each (t on p–q, u on a–b), or null when they do not cross
 * (parallel lines never do) */
export function crossing(p: Pt, q: Pt, a: Pt, b: Pt): { t: number; u: number } | null {
  const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < GEO_EPS) return null;
  const t = ((a.x - p.x) * sy - (a.y - p.y) * sx) / den, u = ((a.x - p.x) * ry - (a.y - p.y) * rx) / den;
  return t >= -GEO_EPS && t <= 1 + GEO_EPS && u >= -GEO_EPS && u <= 1 + GEO_EPS ? { t, u } : null;
}
/** metres between two segments (0 where they cross) */
export function segGap(a0: Pt, a1: Pt, b0: Pt, b1: Pt): number {
  if (crossOf(a0, a1, b0) * crossOf(a0, a1, b1) < 0 && crossOf(b0, b1, a0) * crossOf(b0, b1, a1) < 0) return 0;
  return Math.min(toSegment(a0, b0, b1).d, toSegment(a1, b0, b1).d, toSegment(b0, a0, a1).d, toSegment(b1, a0, a1).d);
}

/** the stretches two outlines share along their sides (collinear and overlapping by more than `min` metres): each from
 * one end to the other */
export function sharedSides(A: Pt[], B: Pt[], min = NEAR_M): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (const [a0, a1] of sidesOf(A)) for (const [b0, b1] of sidesOf(B)) {
    const L = dist(a0, a1);
    if (L < GEO_EPS) continue;
    const ux = (a1.x - a0.x) / L, uy = (a1.y - a0.y) / L;
    const off = (p: Pt) => Math.abs((p.x - a0.x) * uy - (p.y - a0.y) * ux);
    if (off(b0) > NEAR_M || off(b1) > NEAR_M) continue;
    const along = (p: Pt) => (p.x - a0.x) * ux + (p.y - a0.y) * uy;
    const lo = Math.max(0, Math.min(along(b0), along(b1))), hi = Math.min(L, Math.max(along(b0), along(b1)));
    if (hi - lo > min) out.push([{ x: a0.x + ux * lo, y: a0.y + uy * lo }, { x: a0.x + ux * hi, y: a0.y + uy * hi }]);
  }
  return out;
}
/** the outline's middle of side `i`'s outward normal, as a unit [east, north] (counter-clockwise outlines face out to the right) */
export function outward(a: Pt, b: Pt): [number, number] {
  const L = dist(a, b) || 1;
  return [(b.y - a.y) / L, -(b.x - a.x) / L];
}
/** an outline turned counter-clockwise */
export function ccw(pts: Pt[]): Pt[] {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return s < 0 ? [...pts].reverse() : pts;
}
/** a band `w` metres wide along a line of points, as an outline (a road's title, PZ9): each point pushed out either side
 * along the mitre of its two segments */
export function bandOutline(line: Pt[], w: number): Pt[] {
  if (line.length < 2) return line.length ? rectOutline({ x: line[0].x, y: line[0].y, w, d: w }) : [];
  const half = w / 2, left: Pt[] = [], right: Pt[] = [];
  const dir = (a: Pt, b: Pt): [number, number] => { const L = dist(a, b) || 1; return [(b.x - a.x) / L, (b.y - a.y) / L]; };
  for (let i = 0; i < line.length; i++) {
    const d0 = dir(line[Math.max(0, i - 1)], line[Math.max(1, i)]), d1 = dir(line[Math.min(i, line.length - 2)], line[Math.min(i + 1, line.length - 1)]);
    let nx = -(d0[1] + d1[1]), ny = d0[0] + d1[0];
    const L = Math.hypot(nx, ny) || 1;
    nx /= L; ny /= L;
    const k = half / Math.max(0.3, nx * -d1[1] + ny * d1[0]); // the mitre, kept from spiking at sharp bends
    left.push({ x: line[i].x + nx * k, y: line[i].y + ny * k });
    right.push({ x: line[i].x - nx * k, y: line[i].y - ny * k });
  }
  return ccw([...right, ...left.reverse()]);
}
/** metres along a line of points to the point nearest p, and that point */
export function alongLine(line: Pt[], p: Pt): { m: number; at: Pt; len: number } {
  let best = { m: 0, at: line[0], d: Infinity }, run = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const s = toSegment(p, line[i], line[i + 1]), L = dist(line[i], line[i + 1]);
    if (s.d < best.d) best = { m: run + s.t * L, at: s.at, d: s.d };
    run += L;
  }
  return { m: best.m, at: best.at, len: run };
}
/** the point `m` metres along a line of points (clamped to its ends) */
export function pointAlong(line: Pt[], m: number): Pt {
  let run = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const L = dist(line[i], line[i + 1]);
    if (run + L >= m) return lerp(line[i], line[i + 1], L ? (m - run) / L : 0);
    run += L;
  }
  return line[line.length - 1];
}
/** the part of a line of points from `m0` to `m1` metres along it (either way round), as points */
export function lineBetween(line: Pt[], m0: number, m1: number): Pt[] {
  const lo = Math.min(m0, m1), hi = Math.max(m0, m1), out: Pt[] = [pointAlong(line, lo)];
  let run = 0;
  for (let i = 0; i + 1 < line.length; i++) { run += dist(line[i], line[i + 1]); if (run > lo + GEO_EPS && run < hi - GEO_EPS) out.push(line[i + 1]); }
  out.push(pointAlong(line, hi));
  return m0 <= m1 ? out : out.reverse();
}
