// WZ1 land first: code draws a region's land once, from a seed and the Weaver's brief (WZ2), and the region is stored as
// drawn, so nothing on it ever moves. Order: heights, then the river and streams, then settlement sites where the land
// suggests one, then roads that follow the land (least effort over slopes, cover and water; later roads reuse earlier
// ones, so they branch at junctions, WZ8), then the cover, then the brief's landmarks. The same seed and brief always give
// the same land. Agents never give coordinates (MAP-02): the brief is words; code finds the places.
import type { LandFeature, Pt, Region, RoadLine, RoadNode, Side, Site, Water } from '../types';
import { OPP_SIDE, SIDES } from '../types';
import type { RoadDangerKey } from '../scales';
import type { RegionKind } from '../types';
import { createRng } from '../rng';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { LC, RK } from '../library/tableIds';

export type SiteSize = Site['size'];
/** settlement sizes, largest first: sites are placed in this order */
export const SITE_SIZES: readonly SiteSize[] = ['town', 'village', 'hamlet'];
/** WZ2 where the brief asks a settlement or landmark to be, in words code understands */
export const WHERE = ['river', 'crossing', 'confluence', 'hill', 'valley', 'woods', 'remote', 'edge_n', 'edge_e', 'edge_s', 'edge_w'] as const;
export type Where = (typeof WHERE)[number];
/** WZ2 the Weaver's brief for one region, once (src/agents: the region call). Every name is the Weaver's; code draws the
 * land to fit: the river from side to side, each settlement where its words ask, the landmarks, the regions beyond. */
export type RegionBrief = {
  kind: string; name: string; look: string;
  river?: { name: string; from?: Side; to?: Side };
  /** start: WZ13, the settlement the story opens in */
  settlements: { size: SiteSize; name: string; look: string; where?: Where; start?: true }[];
  features: { kind: string; name: string; look: string; where?: Where }[];
  /** the sides the main road leaves by, toward the regions beyond */
  exits?: Side[];
  beyond?: Partial<Record<Side, { name: string; kind?: string }>>;
  danger?: RoadDangerKey;
};
/** what a drawn neighbour fixes on a shared edge: where its roads and waters cross it (metres along the edge from its
 * west or south end; out: the water flows from this region into the neighbour), and its ground heights along the edge,
 * one per cell from the west or south end, so the land rises and falls on across it (WZ18) */
export type EdgeJoin = { side: Side; roads: number[]; waters: { at: number; width: number; kind: Water['kind']; name: string; out: boolean }[]; heights?: number[] };


/** The land maker's shaping numbers (CS26): they change how drawn land looks, never a rule, so they live here, apart from
 * CONFIG. Sizes play reads (region, cell, site spacing, fields, stream and ford widths) stay in CONFIG. Lengths are
 * metres; "share" is a part of the region's side or of its height range (0 to 1); a weight scales one term of a score. */
const LAND = {
  river: {
    /** where on its side a river comes in or leaves: from this share of the side, over the next span */
    edgeFrom: 0.3, edgeSpan: 0.4,
    /** its winding: noise run along it (m), the noise's feature size (m), and the sway at most, as a share of the side */
    swayRunM: 4000, swayScaleM: 1500, sway: 0.35,
    /** width when the kind names none */
    widthM: 15,
    /** a cell this many cells beyond the river's bank counts as on the river (streams end there) */
    reachCells: 0.7,
  },
  /** distances to water are measured to the line thinned to about one point every this many metres */
  waterStepM: 300,
  heights: {
    /** rolling ground and ridge noise feature sizes; rough kinds blend this much ridge in at roughness 1 */
    groundScaleM: 3000, ridgeScaleM: 2200, ridgeShare: 0.5,
    /** valley width as a share of the side; height = ground x groundShare + valley x depth x (lift + ground) + tilt
     * downstream */
    valleyWidth: 0.22, groundShare: 0.15, valleyDepth: 0.55, valleyLift: 0.4, downstreamTilt: 0.12,
    /** each filled hollow cell stands this much above the one it drains to, so water always runs on */
    floodStepM: 0.01,
  },
  streams: {
    /** a source: above this share of the height range, this far from the river and the edge, this far from other sources */
    sourceHeight: 0.4, sourceFromRiverM: 800, sourceFromEdgeM: 300, spacingM: 1500,
    /** a stream shorter than this is dropped (unless a neighbour brings it in) */
    shortestM: 800,
  },
  /** woods noise feature size: where woods grow, read by site words, road cost and the woods cover */
  woodsScaleM: 1800,
  /** how strongly a brief's words pull a site or landmark (WZ2): metres per point, or points at full effect */
  where: { riverM: 200, confluenceM: 300, confluenceCapM: 5000, hill: 6, valley: 6, woods: 8, remoteM: 800, edgeM: 600 },
  sites: {
    /** never nearer the edge than this, nor nearer the river bank than this (above the flood), nor steeper than this */
    fromEdgeM: 600, aboveFloodM: 120, steepest: 0.15,
    /** score: slope weight, water within this distance is free, then a point per this many metres, and a little luck */
    slopeWeight: 40, waterFreeM: 300, waterPerM: 400, luck: 1.5,
    /** a town likes this far from the river, and the region's centre (points per metre off, with and without a river) */
    townRiverM: 250, townCentreM: 2500, townCentreDryM: 1500,
  },
  roads: {
    /** the extra effort of crossing water, per crossing: few crossings, and where the road needs them */
    riverCrossing: 2500, streamCrossing: 150,
    /** wild-ground effort: woods above this noise, slopes above this, and rough ground noise (feature size in m) */
    woodsAt: 0.6, woods: 0.6, steepAt: 0.25, steep: 3, rough: 0.5, roughScaleM: 400,
    /** climbing costs this times the slope squared; the search's guess is this share of the straight distance */
    climb: 60, guess: 0.3,
    /** a step along an existing road or path costs this share */
    onRoad: 0.3, onPath: 0.5,
    /** with no exits named, each side has this chance to get one; exits keep this many cells from a corner */
    exitChance: 0.6, exitFromCornerCells: 15,
    /** exit score: slope weight, cost of meeting the river, and a little luck */
    exitSlopeWeight: 50, exitAtRiver: 9, exitLuck: 0.5,
    /** crossings nearer each other than this are one */
    crossingMergeM: 50,
  },
  cover: {
    /** water meadows: within this distance of the river plus up to the spread (noise feature size), and low ground (a
     * share of the height range plus metres above the river) */
    meadowM: 100, meadowSpreadM: 300, meadowScaleM: 800, meadowHeight: 0.12, meadowHeightM: 4,
    /** fields reach this share of a site's fields distance, plus up to the spread (noise feature size), on gentle ground */
    fieldsFrom: 0.55, fieldsSpread: 0.9, fieldsScaleM: 900, fieldsSteepest: 0.12,
    /** each wild cover's pull per cell: the cells it suits best take it */
    rockSlope: 10,
    marshFlat: 30, marshLow: 3, marshWaterPerM: 900, marshNoise: 1.5, marshScaleM: 700,
    woodsNoise: 3, woodsSlope: 4,
    heathHigh: 2, heathScaleM: 1200,
    moorHigh: 3, moorScaleM: 2000,
  },
  features: {
    /** a landmark keeps this far from the edge, this far past a settlement's built area, and this far from another */
    fromEdgeM: 300, pastBuiltM: 100, apartM: 500,
    /** score: a point per this many metres from water (unless it seeks the river), luck, and with no words a point per
     * this many metres from the nearest site */
    waterPerM: 5000, luck: 2, remotePerM: 1000,
  },
} as const;


// ---------- noise (seeded value noise) ----------
function hash(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function valueNoise(seed: number, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(seed, ix, iy), b = hash(seed, ix + 1, iy), c = hash(seed, ix, iy + 1), d = hash(seed, ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** fractal noise in 0..1 at a point in metres, its largest feature `scale` metres across */
function fbm(seed: number, x: number, y: number, scale: number, octaves = 4): number {
  let sum = 0, amp = 1, norm = 0, f = 1 / scale;
  for (let o = 0; o < octaves; o++) { sum += amp * valueNoise(seed + o * 101, x * f, y * f); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

// ---------- a binary min-heap of cell indexes by a key read when pushed (a pushed cell keeps the key it had then) ----------
function heapOf(key: (i: number) => number) {
  const items: number[] = [], keys: number[] = [];
  const swap = (a: number, b: number) => { [items[a], items[b]] = [items[b], items[a]]; [keys[a], keys[b]] = [keys[b], keys[a]]; };
  return {
    size: () => items.length,
    push(i: number) {
      items.push(i); keys.push(key(i));
      for (let k = items.length - 1; k > 0; ) { const p = (k - 1) >> 1; if (keys[p] <= keys[k]) break; swap(p, k); k = p; }
    },
    pop(): number {
      const top = items[0], last = items.length - 1;
      swap(0, last); items.pop(); keys.pop();
      for (let k = 0; ; ) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < items.length && keys[l] < keys[m]) m = l; if (r < items.length && keys[r] < keys[m]) m = r; if (m === k) break; swap(m, k); k = m; }
      return top;
    },
  };
}

// ---------- small geometry ----------
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
function segDist(p: Pt, a: Pt, b: Pt): { d: number; t: number } {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t };
}
/** nearest distance from p to a line, and how far along the line (0..1) that nearest point is */
function lineDist(p: Pt, pts: Pt[]): { d: number; along: number } {
  let best = { d: Infinity, along: 0 };
  for (let i = 1; i < pts.length; i++) {
    const s = segDist(p, pts[i - 1], pts[i]);
    if (s.d < best.d) best = { d: s.d, along: (i - 1 + s.t) / (pts.length - 1) };
  }
  return best;
}
export const lineLength = (pts: Pt[]) => pts.reduce((n, p, i) => (i ? n + dist(pts[i - 1], p) : 0), 0);
/** Chaikin corner cutting, ends kept */
function soften(pts: Pt[], passes = 2): Pt[] {
  let out = pts;
  for (let k = 0; k < passes && out.length > 2; k++) {
    const next: Pt[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}
function crossAt(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, y: a.y + t * r.y } : null;
}
const round = (p: Pt): Pt => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** a land cover id as the one character the region's cover string keeps per cell, and back */
export const coverChar = (id: string) => Number(id.slice(2)).toString(36);
export const coverOf = (r: Region, i: number) => `LC${parseInt(r.cover[i], 36)}`;

/**
 * Draws one region. `seed` and `brief` decide everything; `joins` (a drawn neighbour's roads and waters on a shared edge)
 * are carried over so the land runs on across the edge.
 */
export function drawRegion(id: string, gx: number, gy: number, seed: number, brief: RegionBrief, joins: EdgeJoin[] = []): Region {
  const lib = getLibrary();
  const kind: RegionKind = lib.regionKinds?.[brief.kind] ?? lib.regionKinds![RK.river_valley];
  const S = CONFIG.REGION_SIZE_M, C = CONFIG.REGION_CELL_M, N = Math.round(S / C);
  const ox = gx * S, oy = gy * S;
  const rng = createRng(seed);
  const at = (i: number): Pt => ({ x: ox + ((i % N) + 0.5) * C, y: oy + (Math.floor(i / N) + 0.5) * C });
  const cellOf = (p: Pt) => Math.min(N - 1, Math.max(0, Math.floor((p.y - oy) / C))) * N + Math.min(N - 1, Math.max(0, Math.floor((p.x - ox) / C)));
  const edgePoint = (side: Side, t: number): Pt => side === 'n' ? { x: ox + t, y: oy + S } : side === 's' ? { x: ox + t, y: oy } : side === 'e' ? { x: ox + S, y: oy + t } : { x: ox, y: oy + t };
  const nearSide = (p: Pt, side: Side) => side === 'n' ? oy + S - p.y : side === 's' ? p.y - oy : side === 'e' ? ox + S - p.x : p.x - ox;
  const [lo, hi] = kind.relief;
  const cells = N * N;

  // ---- the river: from one side to another, winding (a join from a drawn neighbour fixes where it comes in or leaves) ----
  const waters: Water[] = [];
  const riverJoin = joins.flatMap((j) => j.waters.filter((w) => w.kind === 'river').map((w) => ({ ...w, side: j.side })));
  let river: Water | undefined;
  if (kind.river || brief.river || riverJoin.length) {
    const inJ = riverJoin.find((w) => !w.out), outJ = riverJoin.find((w) => w.out);
    const pick = brief.river?.from ?? SIDES[rng.int(0, SIDES.length - 1)];
    const from: Side = inJ?.side ?? (outJ && pick === outJ.side ? OPP_SIDE[outJ.side] : pick);
    const to: Side = outJ?.side ?? (brief.river?.to && brief.river.to !== from ? brief.river.to : OPP_SIDE[from]);
    const a = edgePoint(from, inJ?.at ?? S * (LAND.river.edgeFrom + LAND.river.edgeSpan * rng.next())), b = edgePoint(to, outJ?.at ?? S * (LAND.river.edgeFrom + LAND.river.edgeSpan * rng.next()));
    const steps = Math.ceil(dist(a, b) / C);
    const nx = -(b.y - a.y) / dist(a, b), ny = (b.x - a.x) / dist(a, b);
    const pts: Pt[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, sway = (fbm(seed + 7, t * LAND.river.swayRunM, 0, LAND.river.swayScaleM, 3) - 0.5) * S * LAND.river.sway * Math.sin(Math.PI * t);
      pts.push({ x: a.x + (b.x - a.x) * t + nx * sway, y: a.y + (b.y - a.y) * t + ny * sway });
    }
    const width = inJ?.width ?? kind.river?.width ?? LAND.river.widthM;
    river = { id: `${id}_w1`, kind: 'river', name: inJ?.name ?? brief.river?.name ?? '', width, pts: soften(pts).map(round) };
    waters.push(river);
  }

  // ---- heights: rolling ground (rougher kinds ridged), a valley along the river, tilted downstream ----
  const heights = new Array<number>(cells);
  // distances to water are measured to the line thinned to about every LAND.waterStepM: close enough for valleys and site scores
  const coarse = (pts: Pt[]) => pts.filter((_, k) => k % Math.max(1, Math.round(pts.length / (lineLength(pts) / LAND.waterStepM))) === 0 || k === pts.length - 1);
  const riverCoarse = river ? coarse(river.pts) : [];
  const riverAlong = new Float64Array(cells), riverD = new Float64Array(cells).fill(Infinity);
  for (let i = 0; i < cells; i++) {
    const p = at(i);
    let n = fbm(seed, p.x, p.y, LAND.heights.groundScaleM);
    const ridge = 1 - Math.abs(2 * fbm(seed + 31, p.x, p.y, LAND.heights.ridgeScaleM, 3) - 1);
    n = n * (1 - kind.rough * LAND.heights.ridgeShare) + ridge * kind.rough * LAND.heights.ridgeShare;
    let h = n;
    if (river) {
      const r = lineDist(p, riverCoarse);
      riverD[i] = r.d; riverAlong[i] = r.along;
      const valley = 1 - Math.exp(-((r.d / (S * LAND.heights.valleyWidth)) ** 2));
      h = LAND.heights.groundShare * n + LAND.heights.valleyDepth * valley * (LAND.heights.valleyLift + n) + LAND.heights.downstreamTilt * (1 - r.along);
    }
    heights[i] = Math.round(lo + (hi - lo) * Math.max(0, Math.min(1, h)));
  }
  // WZ18: near a drawn neighbour the ground eases into the heights along its edge, over REGION_EDGE_BLEND_M. The slope
  // that makes is only the meeting of two kinds of land, so bare rock still goes by the region's own ground (own)
  const own = Float64Array.from(heights);
  for (const j of joins) {
    if (!j.heights?.length) continue;
    const B = CONFIG.REGION_EDGE_BLEND_M;
    for (let i = 0; i < cells; i++) {
      const p = at(i), d = nearSide(p, j.side);
      if (d >= B) continue;
      const k = j.side === 'n' || j.side === 's' ? i % N : Math.floor(i / N), w = smooth(d / B);
      heights[i] = Math.round(heights[i] * w + j.heights[k] * (1 - w));
    }
  }
  const slopes = new Float64Array(cells), ownSlopes = new Float64Array(cells), margin = new Float64Array(cells);
  for (let i = 0; i < cells; i++) {
    const c = i % N, r = Math.floor(i / N);
    let m = 0, mo = 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc >= 0 && cc < N && rr >= 0 && rr < N) { m = Math.max(m, Math.abs(heights[rr * N + cc] - heights[i]) / C); mo = Math.max(mo, Math.abs(own[rr * N + cc] - own[i]) / C); }
    }
    slopes[i] = m; ownSlopes[i] = mo;
    margin[i] = (Math.min(c, r, N - 1 - c, N - 1 - r) + 0.5) * C; // metres to the nearest edge
  }
  const slope = (i: number) => slopes[i];
  const neighbours = (i: number): number[] => {
    const c = i % N, r = Math.floor(i / N), out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const cc = c + dc, rr = r + dr;
      if (cc >= 0 && cc < N && rr >= 0 && rr < N) out.push(rr * N + cc);
    }
    return out;
  };

  // ---- streams: from high ground down to the river, another stream or the edge. Hollows are filled first (priority
  // flood) so every cell drains somewhere and no stream circles in a pit ----
  const outlet = (i: number) => { const c = i % N, r = Math.floor(i / N); return c === 0 || r === 0 || c === N - 1 || r === N - 1 || (!!river && riverD[i] < river.width / 2 + C * LAND.river.reachCells); };
  const filled = Float64Array.from(heights);
  {
    const heap = heapOf((i) => filled[i]), done = new Uint8Array(cells);
    for (let i = 0; i < cells; i++) if (outlet(i)) { done[i] = 1; heap.push(i); }
    while (heap.size()) { const i = heap.pop(); for (const j of neighbours(i)) if (!done[j]) { done[j] = 1; filled[j] = Math.max(filled[j], filled[i] + LAND.heights.floodStepM); heap.push(j); } }
  }
  const streamCell = new Int32Array(cells).fill(-1);
  const streamJoins = joins.flatMap((j) => j.waters.filter((w) => w.kind === 'stream' && !w.out).map((w) => ({ ...w, side: j.side })));
  const sources = [...Array(cells).keys()].filter((i) => heights[i] > lo + (hi - lo) * LAND.streams.sourceHeight && riverD[i] > LAND.streams.sourceFromRiverM && margin[i] > LAND.streams.sourceFromEdgeM)
    .map((i) => ({ i, k: rng.next() })).sort((a, b) => a.k - b.k).map((x) => x.i);
  const starts: { i: number; from?: Pt; width?: number; name?: string }[] = streamJoins.map((w) => ({ i: cellOf(edgePoint(w.side, w.at)), from: edgePoint(w.side, w.at), width: w.width, name: w.name }));
  for (const i of sources) {
    if (starts.length >= kind.streams + streamJoins.length) break;
    if (starts.some((s) => dist(at(s.i), at(i)) < LAND.streams.spacingM)) continue;
    starts.push({ i });
  }
  for (const s of starts) {
    const path = [s.i];
    let cur = s.i, end: Pt | undefined;
    for (let step = 0; step < cells; step++) {
      if (river && riverD[cur] < river.width / 2 + C * LAND.river.reachCells) { end = river.pts[Math.round(riverAlong[cur] * (river.pts.length - 1))]; break; }
      if (streamCell[cur] >= 0) { end = at(cur); path.pop(); break; }
      if (step && outlet(cur)) break;
      const next = neighbours(cur).filter((j) => filled[j] < filled[cur]).sort((a, b) => filled[a] - filled[b] || heights[a] - heights[b])[0];
      if (next === undefined) break;
      path.push(next); cur = next;
    }
    if (path.length * C < LAND.streams.shortestM && !s.from) continue;
    const n = waters.length + 1;
    for (const i of path) if (streamCell[i] < 0) streamCell[i] = n;
    const pts = [...(s.from ? [s.from] : []), ...path.map(at), ...(end ? [end] : [])];
    const [w0, w1] = CONFIG.STREAM_WIDTH_M;
    waters.push({ id: `${id}_w${n}`, kind: 'stream', name: s.name ?? '', width: s.width ?? Math.round(w0 + (w1 - w0) * rng.next()), pts: soften(pts, 3).map(round) });
  }
  const waterD = new Float64Array(cells);
  const waterCoarse = waters.map((w) => coarse(w.pts));
  for (let i = 0; i < cells; i++) waterD[i] = Math.min(...waterCoarse.map((pts) => lineDist(at(i), pts).d));

  // ---- settlement sites: flat, dry ground near water, spaced like real parishes; the brief's words pull each one ----
  const woodsNoise = (i: number) => fbm(seed + 53, at(i).x, at(i).y, LAND.woodsScaleM, 4);
  const centre: Pt = { x: ox + S / 2, y: oy + S / 2 };
  const sizes: { size: SiteSize; name: string; look: string; where?: Where }[] = brief.settlements.length ? [...brief.settlements] : [
    ...Array.from({ length: kind.settlements.town }, () => ({ size: 'town' as const, name: '', look: '' })),
    ...Array.from({ length: rng.int(...kind.settlements.village) }, () => ({ size: 'village' as const, name: '', look: '' })),
    ...Array.from({ length: rng.int(...kind.settlements.hamlet) }, () => ({ size: 'hamlet' as const, name: '', look: '' })),
  ];
  sizes.sort((a, b) => SITE_SIZES.indexOf(a.size) - SITE_SIZES.indexOf(b.size));
  const sites: Site[] = [];
  const whereScore = (w: Where | undefined, i: number): number => {
    const p = at(i), hn = (heights[i] - lo) / Math.max(1, hi - lo);
    switch (w) {
      case 'river': case 'crossing': return river ? -riverD[i] / LAND.where.riverM : 0;
      case 'confluence': return river ? -riverD[i] / LAND.where.confluenceM - Math.min(...waters.filter((x) => x.kind === 'stream').map((x) => dist(p, x.pts[x.pts.length - 1])), LAND.where.confluenceCapM) / LAND.where.confluenceM : 0;
      case 'hill': return hn * LAND.where.hill;
      case 'valley': return -hn * LAND.where.valley;
      case 'woods': return woodsNoise(i) * LAND.where.woods;
      case 'remote': return Math.min(...sites.map((s) => dist(s.at, p)), S) / LAND.where.remoteM;
      case 'edge_n': case 'edge_e': case 'edge_s': case 'edge_w': return -nearSide(p, w.slice('edge_'.length) as Side) / LAND.where.edgeM;
      default: return 0;
    }
  };
  for (const want of sizes) {
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < cells; i++) {
      const p = at(i);
      if (margin[i] < LAND.sites.fromEdgeM) continue;
      if (river && riverD[i] < river.width / 2 + LAND.sites.aboveFloodM) continue; // above the flood
      if (sites.some((s) => dist(s.at, p) < Math.min(CONFIG.SITE_SPACING_M[s.size], CONFIG.SITE_SPACING_M[want.size]))) continue;
      const sl = slope(i);
      if (sl > LAND.sites.steepest) continue;
      let score = -sl * LAND.sites.slopeWeight - Math.max(0, waterD[i] - LAND.sites.waterFreeM) / LAND.sites.waterPerM + hash(seed, i, 11) * LAND.sites.luck;
      if (want.size === 'town') score += river ? -Math.abs(riverD[i] - LAND.sites.townRiverM) / LAND.sites.townRiverM - dist(p, centre) / LAND.sites.townCentreM : -dist(p, centre) / LAND.sites.townCentreDryM;
      score += whereScore(want.where, i);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) continue;
    const n = sites.length + 1;
    sites.push({ id: `${id}_s${n}`, size: want.size, name: want.name, look: want.look, at: at(best), why: want.where ?? (want.size === 'town' && river ? 'river' : 'land') });
  }

  // ---- roads: least effort over the land; each later road reuses the earlier ones, so they branch (WZ8) ----
  // water lines in buckets by cell, so a step of a road can tell which waters it crosses
  const bucket = new Map<number, { a: Pt; b: Pt; w: Water }[]>();
  for (const w of waters) for (let k = 1; k < w.pts.length; k++) {
    const a = w.pts[k - 1], b = w.pts[k];
    const c0 = cellOf({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }), c1 = cellOf({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) });
    for (let r = Math.floor(c0 / N); r <= Math.floor(c1 / N); r++) for (let c = c0 % N; c <= c1 % N; c++) { const i = r * N + c; if (!bucket.has(i)) bucket.set(i, []); bucket.get(i)!.push({ a, b, w }); }
  }
  const crossCost = (from: number, to: number): number => {
    const a = at(from), b = at(to), hits = new Set<Water>();
    for (const t of [0, 0.34, 0.67, 1]) for (const x of bucket.get(cellOf({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) ?? []) if (crossAt(a, b, x.a, x.b)) hits.add(x.w);
    let n = 0;
    for (const w of hits) n += w.kind === 'river' ? LAND.roads.riverCrossing : LAND.roads.streamCrossing;
    return n;
  };
  const roadClass = new Uint8Array(cells); // 0 none, 1 path, 2 road
  const R = LAND.roads;
  const wildCost = (i: number) => (woodsNoise(i) > R.woodsAt ? R.woods : 0) + (slope(i) > R.steepAt ? R.steep : 0) + R.rough * fbm(seed + 61, at(i).x, at(i).y, R.roughScaleM, 2);
  // a step goes to any of the 16 cells a king or knight move away, so roads run at many angles, not just the grid's
  const MOVES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
  function route(from: number, goals: Set<number>): number[] | null {
    const g = new Float64Array(cells).fill(Infinity), f = new Float64Array(cells).fill(Infinity), prev = new Int32Array(cells).fill(-1), done = new Uint8Array(cells);
    const goalPts = [...goals].map(at);
    const h = (i: number) => { const p = at(i); let m = Infinity; for (const t of goalPts) m = Math.min(m, dist(p, t)); return m * R.guess; };
    const open = heapOf((i) => f[i]);
    g[from] = 0; f[from] = h(from);
    open.push(from);
    while (open.size()) {
      const cur = open.pop();
      if (done[cur]) continue;
      if (goals.has(cur)) {
        const out = [cur];
        for (let p = prev[cur]; p >= 0; p = prev[p]) out.unshift(p);
        return out;
      }
      done[cur] = 1;
      const c = cur % N, r = Math.floor(cur / N);
      for (const [dc, dr] of MOVES) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || cc >= N || rr < 0 || rr >= N) continue;
        const nb = rr * N + cc;
        if (done[nb]) continue;
        const step = Math.hypot(dc, dr) * C, rise = Math.abs(heights[nb] - heights[cur]) / step;
        let cost = step * (1 + R.climb * rise * rise + wildCost(nb)) + crossCost(cur, nb);
        if (roadClass[nb] && roadClass[cur]) cost *= roadClass[nb] === 2 ? R.onRoad : R.onPath;
        const ng = g[cur] + cost;
        if (ng < g[nb]) { g[nb] = ng; prev[nb] = cur; f[nb] = ng + h(nb); open.push(nb); }
      }
    }
    return null;
  }
  const lanes: { cells: number[]; cls: 1 | 2 }[] = [];
  const lay = (cells_: number[] | null, cls: 1 | 2) => {
    if (!cells_ || cells_.length < 2) return;
    for (const i of cells_) roadClass[i] = Math.max(roadClass[i], cls);
    lanes.push({ cells: cells_, cls });
  };
  const siteCell = new Map(sites.map((s) => [s.id, cellOf(s.at)]));
  const town = sites.find((s) => s.size === 'town') ?? sites[0];
  const hub = town ? siteCell.get(town.id)! : cellOf(centre);
  // the main road leaves by the brief's sides (or where named regions lie beyond, or two to three sides), plus every road
  // a drawn neighbour already brings to the edge
  const named = SIDES.filter((sd) => brief.beyond?.[sd]);
  const exitSides = brief.exits?.length ? brief.exits : named.length >= 2 ? named : SIDES.filter(() => rng.next() < R.exitChance).concat(SIDES[rng.int(0, SIDES.length - 1)]);
  const exits: { side: Side; at: Pt; cell: number }[] = [];
  for (const j of joins) for (const t of j.roads) { const p = edgePoint(j.side, t); exits.push({ side: j.side, at: p, cell: cellOf(p) }); }
  for (const side of [...new Set(exitSides)]) {
    if (exits.some((e) => e.side === side)) continue;
    let best = -1, bestScore = Infinity;
    for (let k = R.exitFromCornerCells; k < N - R.exitFromCornerCells; k++) {
      const p = edgePoint(side, (k + 0.5) * C), i = cellOf(p);
      const score = slope(i) * R.exitSlopeWeight + dist(p, at(hub)) / S + (river && riverD[i] < river.width / 2 + C ? R.exitAtRiver : 0) + hash(seed, k, side.charCodeAt(0)) * R.exitLuck;
      if (score < bestScore) { bestScore = score; best = k; }
    }
    const p = edgePoint(side, (best + 0.5) * C);
    exits.push({ side, at: p, cell: cellOf(p) });
  }
  for (const e of exits) lay(route(e.cell, new Set([hub])), 2);
  for (const s of sites.filter((x) => x.size === 'village')) {
    const net = new Set([hub, ...[...Array(cells).keys()].filter((i) => roadClass[i] === 2)]);
    lay(route(siteCell.get(s.id)!, net), 2);
  }
  for (const s of sites.filter((x) => x.size === 'hamlet')) {
    const net = new Set([...[...Array(cells).keys()].filter((i) => roadClass[i] > 0), ...sites.filter((x) => x.size !== 'hamlet').map((x) => siteCell.get(x.id)!)]);
    lay(route(siteCell.get(s.id)!, net), 1);
  }

  // the network: nodes at sites, edge exits and wherever lanes meet or end; a road line between each two nodes
  const adj = new Map<number, Map<number, 1 | 2>>();
  for (const l of lanes) for (let k = 1; k < l.cells.length; k++) {
    const a = l.cells[k - 1], b = l.cells[k];
    for (const [x, y] of [[a, b], [b, a]]) { if (!adj.has(x)) adj.set(x, new Map()); adj.get(x)!.set(y, Math.max(adj.get(x)!.get(y) ?? 0, l.cls) as 1 | 2); }
  }
  const nodeAt = new Map<number, RoadNode>();
  for (const s of sites) { const c = siteCell.get(s.id)!; if (adj.has(c)) nodeAt.set(c, { id: `${id}_n${nodeAt.size + 1}`, kind: 'site', at: s.at, site: s.id }); }
  for (const e of exits) if (adj.has(e.cell) && !nodeAt.has(e.cell)) nodeAt.set(e.cell, { id: `${id}_n${nodeAt.size + 1}`, kind: 'edge', at: round(e.at), side: e.side });
  for (const [c, m] of adj) if (m.size !== 2 && !nodeAt.has(c)) nodeAt.set(c, { id: `${id}_n${nodeAt.size + 1}`, kind: 'junction', at: at(c) });
  const roads: RoadLine[] = [];
  const walked = new Set<string>();
  const danger = brief.danger ?? kind.danger;
  for (const [start, node] of nodeAt) for (const first of adj.get(start)!.keys()) {
    if (walked.has(`${start}>${first}`)) continue;
    const cellsOn = [start];
    let prev = start, cur = first, cls: 1 | 2 = adj.get(start)!.get(first)!;
    walked.add(`${start}>${first}`);
    while (!nodeAt.has(cur)) {
      cellsOn.push(cur);
      const next = [...adj.get(cur)!.keys()].find((x) => x !== prev);
      if (next === undefined) break;
      cls = Math.max(cls, adj.get(cur)!.get(next)!) as 1 | 2;
      walked.add(`${cur}>${next}`); walked.add(`${cur}>${prev}`);
      prev = cur; cur = next;
    }
    walked.add(`${cur}>${prev}`);
    cellsOn.push(cur);
    const end = nodeAt.get(cur);
    if (!end || end === node) continue;
    const pts = soften(cellsOn.map((c) => nodeAt.get(c)?.at ?? at(c)), 3).map(round);
    const crossings: RoadLine['crossings'] = [];
    for (let a = 1; a < pts.length; a++) for (const c of new Set([cellOf(pts[a - 1]), cellOf(pts[a])])) for (const ws of bucket.get(c) ?? []) {
      const x = crossAt(pts[a - 1], pts[a], ws.a, ws.b), w = ws.w;
      if (x && !crossings.some((q) => dist(q.at, x) < R.crossingMergeM)) crossings.push({ at: round(x), kind: w.width > CONFIG.FORD_MAX_WIDTH_M ? 'bridge' : 'ford', water: w.id });
    }
    roads.push({ id: `${id}_r${roads.length + 1}`, kind: cls === 2 ? 'road' : 'path', danger, ends: [node.id, end.id], pts, length: Math.round(lineLength(pts)), crossings });
  }

  // ---- cover: settlements and their fields first, the water meadows, then the wild land by the kind's shares ----
  const cover: string[] = new Array(cells);
  const wild: number[] = [];
  const riverLevel = river ? Math.min(...river.pts.map((p) => heights[cellOf(p)])) : lo;
  const V = LAND.cover;
  for (let i = 0; i < cells; i++) {
    const p = at(i);
    let near: { s: Site; d: number } | undefined;
    for (const s of sites) { const d = dist(s.at, p); if (!near || d / CONFIG.SITE_FIELDS_M[s.size] < near.d / CONFIG.SITE_FIELDS_M[near.s.size]) near = { s, d }; }
    const wet = river && riverD[i] < V.meadowM + V.meadowSpreadM * fbm(seed + 83, p.x, p.y, V.meadowScaleM, 2) && heights[i] < riverLevel + (hi - lo) * V.meadowHeight + V.meadowHeightM;
    if (near && near.d < CONFIG.SITE_BUILT_M[near.s.size]) cover[i] = LC.settlement;
    else if (wet) cover[i] = LC.water_meadow;
    else if (near && near.d < CONFIG.SITE_FIELDS_M[near.s.size] * (V.fieldsFrom + V.fieldsSpread * fbm(seed + 77, p.x, p.y, V.fieldsScaleM, 3)) && slope(i) < V.fieldsSteepest) cover[i] = LC.farmland;
    else wild.push(i);
  }
  const hn = (i: number) => (heights[i] - lo) / Math.max(1, hi - lo);
  const SCORE: Record<string, (i: number) => number> = {
    [LC.rock]: (i) => ownSlopes[i] * V.rockSlope + hn(i),
    [LC.marsh]: (i) => -slope(i) * V.marshFlat - hn(i) * V.marshLow - waterD[i] / V.marshWaterPerM + V.marshNoise * fbm(seed + 91, at(i).x, at(i).y, V.marshScaleM, 2),
    [LC.woods]: (i) => woodsNoise(i) * V.woodsNoise + slope(i) * V.woodsSlope,
    [LC.heath]: (i) => hn(i) * V.heathHigh + fbm(seed + 97, at(i).x, at(i).y, V.heathScaleM, 3),
    [LC.moor]: (i) => hn(i) * V.moorHigh + fbm(seed + 99, at(i).x, at(i).y, V.moorScaleM, 2),
  };
  let left = wild;
  for (const lc of [LC.rock, LC.marsh, LC.woods, LC.heath, LC.moor].filter((x) => kind.wild[x])) {
    const take = Math.round(wild.length * kind.wild[lc]);
    const score = SCORE[lc];
    const ranked = left.map((i) => ({ i, s: score(i) })).sort((a, b) => b.s - a.s);
    for (const { i } of ranked.slice(0, take)) cover[i] = lc;
    left = ranked.slice(take).map((x) => x.i);
  }
  for (const i of left) cover[i] = kind.open;

  // ---- the brief's landmarks, each where its words (or its kind) ask, apart from the settlements ----
  const features: LandFeature[] = [];
  for (const f of brief.features) {
    const seek = f.where ?? (lib.landmarkKinds?.[f.kind]?.seek as Where | undefined);
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < cells; i++) {
      const p = at(i);
      if (margin[i] < LAND.features.fromEdgeM) continue;
      if (sites.some((s) => dist(s.at, p) < CONFIG.SITE_BUILT_M[s.size] + LAND.features.pastBuiltM) || features.some((x) => dist(x.at, p) < LAND.features.apartM)) continue;
      const score = whereScore(seek, i) + (seek === 'river' ? 0 : -waterD[i] / LAND.features.waterPerM) + hash(seed, i, 23) * LAND.features.luck + (seek ? 0 : Math.min(...sites.map((s) => dist(s.at, p)), S) / LAND.features.remotePerM);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) features.push({ id: `${id}_f${features.length + 1}`, kind: f.kind, name: f.name, look: f.look, at: at(best) });
  }

  return {
    id, kind: kind.id, name: brief.name, look: brief.look, gx, gy, seed, size: S, cell: C, heights,
    cover: cover.map(coverChar).join(''), waters, roads, nodes: [...nodeAt.values()], sites, features, beyond: brief.beyond ?? {},
  };
}
