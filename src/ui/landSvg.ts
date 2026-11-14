// WZ1/WZ4 the region map's land layer: a region drawn as SVG markup in its own metre frame (x east, y north, flipped to
// screen). Pure: the same region and mask give the same markup. Colours come from CSS classes (lc-<cover id>, land-*),
// so the play page's tokens decide them. Cells the character has not seen are left out (WZ4); `faint` sites are known
// by word only and are drawn faint.
import type { Region } from '../types';
import { coverOf } from '../land/generate';

export type LandMask = { seen: (i: number) => boolean; faint?: Set<string> };

/** a region's grid values on the cell centres, padded by one cell all round (clamped), so iso shapes reach its edges */
function padded(N: number, v: (i: number) => number): Float64Array {
  const M = N + 2, out = new Float64Array(M * M);
  for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) out[r * M + c] = v(Math.min(N - 1, Math.max(0, r - 1)) * N + Math.min(N - 1, Math.max(0, c - 1)));
  return out;
}
/** 1-2-1 smoothing of a padded field, so iso shapes come out rounded instead of in cell steps */
function blur(f: Float64Array, M: number): Float64Array {
  const out = new Float64Array(f.length);
  for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
    let s = 0, w = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= M || cc >= M) continue;
      const k = (2 - Math.abs(dr)) * (2 - Math.abs(dc));
      s += f[rr * M + cc] * k; w += k;
    }
    out[r * M + c] = s / w;
  }
  return out;
}
/** filled marching squares: the part of the padded field at or over `t`, as one path (screen y = −north) */
function isoFill(f: Float64Array, M: number, t: number, px: (c: number) => number, py: (r: number) => number): string {
  const d: string[] = [];
  for (let r = 0; r < M - 1; r++) {
    let run = -1;
    for (let c = 0; c <= M - 1; c++) {
      const v = c < M - 1 ? [f[r * M + c], f[r * M + c + 1], f[(r + 1) * M + c + 1], f[(r + 1) * M + c]] : null;
      const full = !!v && v.every((x) => x >= t);
      if (full) { if (run < 0) run = c; continue; }
      if (run >= 0) { d.push(`M${px(run)} ${py(r)}H${px(c)}V${py(r + 1)}H${px(run)}Z`); run = -1; }
      if (!v || v.every((x) => x < t)) continue;
      const corner = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]];
      const pts: string[] = [];
      for (let k = 0; k < 4; k++) {
        const a = v[k], b = v[(k + 1) % 4], [ca, ra] = corner[k], [cb, rb] = corner[(k + 1) % 4];
        if (a >= t) pts.push(`${px(ca)} ${py(ra)}`);
        if (a >= t !== b >= t) { const q = (t - a) / (b - a); pts.push(`${Math.round(px(ca) + (px(cb) - px(ca)) * q)} ${Math.round(py(ra) + (py(rb) - py(ra)) * q)}`); }
      }
      d.push(`M${pts.join('L')}Z`);
    }
  }
  return d.join('');
}
/** marching-squares line segments where the padded field crosses `t`, kept only where `keep` (the seen field) is over half */
function isoLines(f: Float64Array, keep: Float64Array, M: number, t: number, px: (c: number) => number, py: (r: number) => number): string {
  const d: string[] = [];
  for (let r = 0; r < M - 1; r++) for (let c = 0; c < M - 1; c++) {
    if (keep[r * M + c] < 0.5) continue;
    const v = [f[r * M + c], f[r * M + c + 1], f[(r + 1) * M + c + 1], f[(r + 1) * M + c]];
    const corner = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]];
    const hits: string[] = [];
    for (let k = 0; k < 4; k++) {
      const a = v[k], b = v[(k + 1) % 4], [ca, ra] = corner[k], [cb, rb] = corner[(k + 1) % 4];
      if (a >= t !== b >= t) { const q = (t - a) / (b - a); hits.push(`${Math.round(px(ca) + (px(cb) - px(ca)) * q)} ${Math.round(py(ra) + (py(rb) - py(ra)) * q)}`); }
    }
    if (hits.length >= 2) d.push(`M${hits[0]}L${hits[1]}`);
    if (hits.length === 4) d.push(`M${hits[2]}L${hits[3]}`);
  }
  return d.join('');
}

/** the land of one region as SVG elements in metres: x as is, y as −y (north up). Wrap them in a group with your scale. */
export function landLayer(r: Region, mask?: LandMask): string {
  const N = Math.round(r.size / r.cell), C = r.cell, ox = r.gx * r.size, oy = r.gy * r.size, M = N + 2;
  const seenOf = mask?.seen ?? (() => true);
  const px = (c: number) => Math.round(ox + (c - 0.5) * C), py = (row: number) => -Math.round(oy + (row - 0.5) * C);
  const seen = blur(padded(N, (i) => (seenOf(i) ? 1 : 0)), M);
  const out: string[] = [`<clipPath id="clip-${r.id}"><rect x="${ox}" y="${-(oy + r.size)}" width="${r.size}" height="${r.size}"/></clipPath><g clip-path="url(#clip-${r.id})">`];
  // cover: each cover's smoothed share of the seen land, drawn where it is the larger part; the commonest first, so the
  // rest sit on it and no gap opens where three meet
  const counts = new Map<string, number>();
  for (let i = 0; i < r.cover.length; i++) counts.set(r.cover[i], (counts.get(r.cover[i]) ?? 0) + 1);
  const order = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  order.forEach((ch, k) => {
    const id = coverOf(r, r.cover.indexOf(ch));
    const f = blur(padded(N, (i) => (r.cover[i] === ch && seenOf(i) ? 1 : 0)), M);
    if (k === 0) for (let i = 0; i < f.length; i++) f[i] = seen[i]; // the commonest cover is the ground under the rest
    const d = isoFill(f, M, k === 0 ? 0.5 : 0.42, px, py);
    if (d) out.push(`<path class="lc lc-${id}" d="${d}"/>`);
  });
  // contours: one line every CONTOUR step of height, a heavier one every fifth
  const h = padded(N, (i) => r.heights[i]);
  const lo = Math.min(...r.heights), hi = Math.max(...r.heights);
  const step = hi - lo > 250 ? 25 : 10;
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
    const d = isoLines(h, seen, M, t, px, py);
    if (d) out.push(`<path class="land-contour${t % (step * 5) ? '' : ' land-contour-major'}" d="${d}"/>`);
  }
  out.push('</g>');
  const cellSeen = (p: { x: number; y: number }) => {
    const c = Math.floor((p.x - ox) / C), row = Math.floor((p.y - oy) / C);
    return c >= 0 && c < N && row >= 0 && row < N && seenOf(row * N + c);
  };
  // waters and roads: only the stretches over seen land
  const runs = (pts: { x: number; y: number }[]) => {
    const parts: string[] = [];
    let cur: string[] = [];
    for (const p of pts) {
      if (cellSeen(p)) cur.push(`${Math.round(p.x)},${Math.round(-p.y)}`);
      else { if (cur.length > 1) parts.push(cur.join(' ')); cur = []; }
    }
    if (cur.length > 1) parts.push(cur.join(' '));
    return parts;
  };
  for (const w of r.waters) for (const d of runs(w.pts)) out.push(`<polyline class="land-water land-${w.kind}" data-id="${w.id}" style="--w:${w.width}" points="${d}"/>`);
  for (const rd of r.roads) for (const d of runs(rd.pts)) out.push(`<polyline class="land-road land-${rd.kind}" data-id="${rd.id}" points="${d}"/>`);
  for (const rd of r.roads) for (const x of rd.crossings) if (cellSeen(x.at)) out.push(`<circle class="land-${x.kind}" cx="${x.at.x}" cy="${-x.at.y}" r="30"/>`);
  return out.join('');
}

/** settlements and landmarks over the land: a mark and a name each (seen ones, and those known by word, faint) */
export function landMarks(r: Region, mask?: LandMask): string {
  const N = Math.round(r.size / r.cell), C = r.cell, ox = r.gx * r.size, oy = r.gy * r.size;
  const seen = mask?.seen ?? (() => true);
  const at = (p: { x: number; y: number }) => seen(Math.floor((p.y - oy) / C) * N + Math.floor((p.x - ox) / C));
  const R = { town: 160, village: 100, hamlet: 60 } as const;
  const out: string[] = [];
  for (const s of r.sites) {
    const faint = !at(s.at) && mask?.faint?.has(s.id);
    if (!at(s.at) && !faint) continue;
    out.push(`<g class="land-site land-${s.size}${faint ? ' land-faint' : ''}" data-id="${s.id}"><circle cx="${s.at.x}" cy="${-s.at.y}" r="${R[s.size]}"/>` +
      (s.name ? `<text x="${s.at.x}" y="${-s.at.y - R[s.size] - 60}">${s.name}</text>` : '') + '</g>');
  }
  for (const f of r.features) {
    if (!at(f.at)) continue;
    out.push(`<g class="land-feature" data-id="${f.id}"><rect x="${f.at.x - 50}" y="${-f.at.y - 50}" width="100" height="100" transform="rotate(45 ${f.at.x} ${-f.at.y})"/>` +
      (f.name ? `<text x="${f.at.x}" y="${-f.at.y - 110}">${f.name}</text>` : '') + '</g>');
  }
  return out.join('');
}
