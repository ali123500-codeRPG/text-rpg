// The stage map's layout (rpg-map MAP-10..42): from the zones the character knows on one floor, code works out where every
// mark goes, in screen pixels at the map's zoom, before anything is drawn. Zones keep their stored rectangles (metres,
// MAP-03); labels, tokens, doors, stairs, furniture and exit notes are placed here so none covers another (MAP-22, MAP-31),
// yielding in the order MAP-23 sets. No DOM: map.ts draws the scene, and a measure function gives text widths (the
// browser's own in the page, an estimate in tests).
import { compassOf, type MapLink, type MapPerson, type MapWay, type MapZone } from './mapData';
import { verticalOf } from '../scenario/heights';

/** screen pixels per metre before zoom; the scale bar is drawn from it too (MAP-10) */
export const PX_PER_M = 12;
export type Box = { x0: number; y0: number; x1: number; y1: number };
/** the text styles the map measures: a zone's name, a place's title, an exit's note */
export type TextKind = 'label' | 'title' | 'note';
/** font size, box height and side padding of each text style, in screen pixels */
export const TEXT: Record<TextKind, { size: number; weight: number; h: number; pad: number; line: number }> = {
  label: { size: 12, weight: 700, h: 18, pad: 6, line: 14 },
  title: { size: 11, weight: 800, h: 16, pad: 5, line: 13 },
  note: { size: 11, weight: 600, h: 18, pad: 7, line: 13 },
};
/** the width of a text in a style, in screen pixels */
export type Measure = (text: string, kind: TextKind) => number;
/** a stand-in for the browser's measure where there is none (tests): a little wide, so real text always fits its box */
export const roughMeasure: Measure = (t, k) => t.length * TEXT[k].size * (k === 'title' ? 0.72 : 0.6);

/** what a zone is to the character (MAP-33): where it is, been in, or only seen across an exit */
export type ZoneState = 'current' | 'explored' | 'seen';
export type SZone = { z: MapZone; box: Box; state: ZoneState };
export type SPlace = { id: string; name: string; box: Box; title: SText };
export type SText = Box & { text: string; full: string; cut: boolean; lines: string[] };
export type SLabel = SText & { zoneId: string; placement: 'inside' | 'outside'; leader?: [number, number, number, number] };
export type SDoor = Box & { id: string; cx: number; cy: number; dir: 'h' | 'v'; kind: 'door' | 'opening' | 'group'; way?: MapWay; count?: number; title: string; zones: string[] };
export type SConnector = { id: string; a: string; b: string; x1: number; y1: number; x2: number; y2: number; sight: boolean; title: string };
export type SExit = { id: string; zoneId: string; target: string; state: string; x1: number; y1: number; x2: number; y2: number; note: SText; goto?: string; way?: MapWay; title: string };
export type SStair = Box & { id: string; zoneId: string; cx: number; cy: number; up: boolean; goto?: string; title: string };
export type SFurn = Box & { id: string; zoneId: string; kind: string; name: string; cx: number; cy: number };
export type SToken = Box & { id: string; zoneId: string; cx: number; cy: number; r: number; you?: true; who?: MapPerson; title: string };
export type Scene = {
  zones: SZone[]; places: SPlace[]; labels: SLabel[]; doors: SDoor[]; connectors: SConnector[]; exits: SExit[];
  stairs: SStair[]; furniture: SFurn[]; tokens: SToken[];
  /** furniture with no free spot in its zone: listed in the zone's card, not drawn */
  dropped: string[];
  /** exits with no spot for their arrow and note: a finding, never silent (MAP-32) */
  lost: string[];
  /** what the map shows, for its key (MAP-30) */
  used: Set<string>;
  bounds: Box;
};
export type PlanPlace = { id: string; name: string; depth: number; zones: MapZone[] };
export type PlanInput = {
  /** the zones on the floor shown */
  zones: MapZone[];
  /** every zone of this map (all floors), for stairs that lead to a known zone */
  every: MapZone[];
  /** the inner places with zones on this floor (outer first) */
  places: PlanPlace[];
  /** zoom: screen pixels per map pixel */
  k: number;
  measure: Measure;
  /** MAP-33: the zones the character has stood in, when the save records them; without it every known zone is drawn as
   *  explored (the trail keeps only the last few zones left, too few to tell seen from been in) */
  visits?: Set<string>;
  /** the name of the top-level place a known zone off this map sits in, for exits that open another map */
  awayName: (zoneId: string) => string | undefined;
};

const WAY_R = 8, STAIR_R = 10, FURN_R = 9, PIN_R = 9, WHO_R = 7;
/** gap between a mark and anything near it, a label and its zone's walls (MAP-20), a connector and a zone (MAP-14) */
const GAP = 2, PAD = 7, LINK_GAP = 6; // PAD: 6 px (MAP-20) plus the hair the drawn zone sits inside its walls
const ARROWS = [22, 40, 60, 84, 112, 144, 180];
const hit = (a: Box, b: Box, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
const within = (a: Box, b: Box, pad = 0) => a.x0 >= b.x0 + pad - 1e-6 && a.x1 <= b.x1 - pad + 1e-6 && a.y0 >= b.y0 + pad - 1e-6 && a.y1 <= b.y1 - pad + 1e-6;
const disc = (cx: number, cy: number, r: number): Box => ({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r });
const r2 = (v: number) => Math.round(v * 100) / 100;
const union = (bs: Box[]): Box => bs.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
type Side = 'n' | 'e' | 's' | 'w';
/** a compass word's side on screen (y down): [east, south] */
const sideOf = (d: [number, number]): Side => (Math.abs(d[0]) >= Math.abs(d[1]) ? (d[0] >= 0 ? 'e' : 'w') : d[1] >= 0 ? 's' : 'n');
/** a barrier in a few words, for exit notes */
const shutWord = (w?: MapWay) => (w?.shut === 'locked' && w.key ? 'locked, your key' : w?.shut ?? '');

/** the zone's rectangle on screen at zoom k (y down) */
export function zoneBox(z: MapZone, k: number): Box {
  const r = z.rect!, s = PX_PER_M * k;
  return { x0: r2((r.x - r.w / 2) * s), y0: r2(-(r.y + r.d / 2) * s), x1: r2((r.x + r.w / 2) * s), y1: r2(-(r.y - r.d / 2) * s) };
}

/** a text cut to fit `max` pixels with an ellipsis (MAP-21: the last resort; the full name goes in its tooltip) */
function cut(text: string, kind: TextKind, max: number, measure: Measure): string {
  if (measure(text, kind) + 2 * TEXT[kind].pad <= max) return text;
  let n = text.length;
  while (n > 1 && measure(text.slice(0, n) + '…', kind) + 2 * TEXT[kind].pad > max) n--;
  return text.slice(0, Math.max(1, n)).trimEnd() + '…';
}

/** a door's box: a short gap across its wall (12 × 6 px), or a disc when it shows its barrier's mark */
const doorBox = (cx: number, cy: number, dir: 'h' | 'v', way?: MapWay): Box =>
  way?.shut ? disc(cx, cy, WAY_R) : dir === 'h' ? { x0: cx - 6, y0: cy - 3, x1: cx + 6, y1: cy + 3 } : { x0: cx - 3, y0: cy - 6, x1: cx + 3, y1: cy + 6 };

/** a text broken at spaces into the fewest lines (up to `most`) no wider than `max` pixels, balanced; null when a word alone
 *  is wider */
export function wrap(text: string, kind: TextKind, max: number, most: number, measure: Measure): string[] | null {
  const words = text.split(/\s+/).filter(Boolean), pad = 2 * TEXT[kind].pad;
  const fill = (lim: number) => {
    const out: string[] = [];
    for (const w of words) {
      const last = out[out.length - 1];
      if (last !== undefined && measure(`${last} ${w}`, kind) + pad <= lim) out[out.length - 1] = `${last} ${w}`; else out.push(w);
    }
    return out;
  };
  if (Math.max(...words.map((w) => measure(w, kind))) + pad > max) return null;
  const one = fill(max);
  if (one.length > most) return null;
  // the narrowest width that still needs no more lines than the widest does
  let lo = Math.max(...words.map((w) => measure(w, kind))) + pad, hi = max;
  for (let i = 0; i < 12 && hi - lo > 2; i++) { const mid = (lo + hi) / 2; if (fill(mid).length <= one.length) hi = mid; else lo = mid; }
  return fill(hi);
}

export function planScene(inp: PlanInput): Scene {
  const { k, measure } = inp;
  const zones: SZone[] = inp.zones.filter((z) => z.rect).map((z) => ({ z, box: zoneBox(z, k), state: z.here ? 'current' : !inp.visits || inp.visits.has(z.id) ? 'explored' : 'seen' }));
  const byId = new Map(zones.map((x) => [x.z.id, x]));
  const used = new Set<string>(zones.map((x) => `state:${x.state}`));
  for (const { z } of zones) {
    used.add(z.outdoor ? 'outdoor' : 'indoor');
    for (const side of ['n', 'e', 's', 'w']) used.add(`edge:${(z.edges as Record<string, string> | undefined)?.[side] ?? (z.outdoor ? 'open' : 'wall')}`);
    if (!z.inView) used.add('remembered');
  }
  // every mark placed so far, with its role: later marks keep clear of them
  const taken: { box: Box; role: 'label' | 'token' | 'icon' | 'exit' | 'title' }[] = [];
  const free = (b: Box) => !taken.some((t) => hit(t.box, b, GAP));
  const overZone = (b: Box, except?: string) => zones.some((x) => x.z.id !== except && hit(x.box, b));
  const take = (box: Box, role: typeof taken[number]['role']) => { taken.push({ box, role }); return box; };
  const textBox = (text: string, kind: TextKind) => ({ w: Math.ceil(measure(text, kind)) + 2 * TEXT[kind].pad, h: TEXT[kind].h });
  const linesBox = (lines: string[], kind: TextKind) => ({ w: Math.ceil(Math.max(...lines.map((l) => measure(l, kind)))) + 2 * TEXT[kind].pad, h: TEXT[kind].h + (lines.length - 1) * TEXT[kind].line });

  const tokens: SToken[] = [];
  /** the first spot near (cx, cy) inside `zb` where a disc of radius r is free, searching outward */
  const nearFree = (cx: number, cy: number, r: number, zb: Box, inset = r + 2): { cx: number; cy: number } | null => {
    const lo = { x: zb.x0 + inset, y: zb.y0 + inset }, hi = { x: zb.x1 - inset, y: zb.y1 - inset };
    if (lo.x > hi.x || lo.y > hi.y) return null;
    const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const x0 = cl(cx, lo.x, hi.x), y0 = cl(cy, lo.y, hi.y);
    for (let ring = 0; ring <= 12; ring++) {
      const step = r + GAP;
      const pts = ring === 0 ? [[0, 0]] : Array.from({ length: 8 * ring }, (_, i) => { const a = (i / (8 * ring)) * Math.PI * 2; return [Math.cos(a) * ring * step, Math.sin(a) * ring * step]; });
      for (const [dx, dy] of pts) {
        const x = cl(x0 + dx, lo.x, hi.x), y = cl(y0 + dy, lo.y, hi.y);
        if (free(disc(x, y, r))) return { cx: x, cy: y };
      }
    }
    return null;
  };
  // ---- doors (MAP-14, MAP-31): a gap drawn in the wall two linked zones share, at its middle (stepped along it only to keep
  // clear of you or another door); zones that don't touch get a connector
  const doors: SDoor[] = [], connectors: SConnector[] = [];
  const pairs = new Map<string, { a: SZone; b: SZone; links: MapLink[] }>();
  for (const a of zones) for (const l of a.z.links) {
    const b = byId.get(l.to);
    if (!b || b === a) continue;
    const key = [a.z.id, b.z.id].sort().join('|');
    const p = pairs.get(key) ?? { a: a.z.id < b.z.id ? a : b, b: a.z.id < b.z.id ? b : a, links: [] };
    p.links.push(l); pairs.set(key, p);
  }
  type Wall = { d: SDoor; side: string; lo: number; hi: number };
  const walls: Wall[] = [];
  for (const [key, { a, b, links }] of pairs) {
    const way = links.find((l) => l.way?.shut)?.way ?? links.find((l) => l.way)?.way;
    if (way?.shut) used.add(`way:${way.shut}${way.key ? '-key' : ''}`);
    const A = a.box, B = b.box;
    const x0 = Math.max(A.x0, B.x0), x1 = Math.min(A.x1, B.x1), y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1);
    const vWall = Math.abs(x1 - x0) < 0.5 && y1 - y0 >= 1, hWall = Math.abs(y1 - y0) < 0.5 && x1 - x0 >= 1;
    const title = `${links[0].label}: ${a.z.name} ↔ ${b.z.name}${way ? ` · ${shutWord(way) || way.kind}` : ''}`;
    if (vWall || hWall) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dir = hWall ? 'h' as const : 'v' as const;
      const kind = way?.shut ? 'door' as const : !way && a.z.outdoor && b.z.outdoor ? 'opening' as const : 'door' as const;
      used.add(way?.shut ? 'door' : kind);
      const d: SDoor = { id: `door:${key}`, cx, cy, ...doorBox(cx, cy, dir, way), dir, kind, ...(way ? { way } : {}), title, zones: [a.z.id, b.z.id] };
      // the wall it sits on, named by the smaller zone's side, for MAP-31's count badge
      const small = (A.x1 - A.x0) * (A.y1 - A.y0) <= (B.x1 - B.x0) * (B.y1 - B.y0) ? a : b;
      const side = vWall ? (Math.abs(small.box.x0 - cx) < 1 ? 'w' : 'e') : Math.abs(small.box.y0 - cy) < 1 ? 'n' : 's';
      walls.push({ d, side: `${small.z.id}:${side}`, lo: hWall ? x0 : y0, hi: hWall ? x1 : y1 });
    } else {
      // the line between the two zones' nearest sides, kept 6 px off each (MAP-14)
      const ca = { x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2 }, cb = { x: (B.x0 + B.x1) / 2, y: (B.y0 + B.y1) / 2 };
      const exitAt = (bx: Box, c: { x: number; y: number }, to: { x: number; y: number }) => {
        const dx = to.x - c.x, dy = to.y - c.y;
        const t = Math.min(Math.abs((bx.x1 - bx.x0) / 2 / (dx || 1e-9)), Math.abs((bx.y1 - bx.y0) / 2 / (dy || 1e-9)));
        const len = Math.hypot(dx, dy) || 1;
        return { x: c.x + dx * t + (dx / len) * LINK_GAP, y: c.y + dy * t + (dy / len) * LINK_GAP };
      };
      const p1 = exitAt(A, ca, cb), p2 = exitAt(B, cb, ca);
      connectors.push({ id: `link:${key}`, a: a.z.id, b: b.z.id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, sight: links.some((l) => l.sight), title });
      used.add(links.some((l) => l.sight) ? 'link' : 'link-hidden');
      if (way?.shut) { const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2; const d: SDoor = { id: `door:${key}`, cx, cy, ...disc(cx, cy, WAY_R), dir: 'h', kind: 'door', way, title, zones: [a.z.id, b.z.id] }; doors.push(d); take(d, 'icon'); used.add('door'); }
    }
  }
  const wallsOf = new Map<string, Wall[]>();
  for (const w of walls) wallsOf.set(w.side, [...(wallsOf.get(w.side) ?? []), w]);
  for (const [sk, ws] of wallsOf) {
    if (ws.length > 3) {
      // more than three on one wall: one badge with the count (MAP-31)
      const cx = ws.reduce((n, w) => n + w.d.cx, 0) / ws.length, cy = ws.reduce((n, w) => n + w.d.cy, 0) / ws.length;
      const d: SDoor = { id: `doors:${sk}`, cx, cy, ...disc(cx, cy, WAY_R), dir: ws[0].d.dir, kind: 'group', count: ws.length, title: ws.map((w) => w.d.title).join('\n'), zones: [...new Set(ws.flatMap((w) => w.d.zones))] };
      doors.push(d); take(d, 'icon'); used.add('group');
      continue;
    }
    for (const { d, lo, hi } of ws) {
      // the middle of the shared wall, else the nearest step along it that is clear, never past its ends
      const half = d.dir === 'h' ? (d.x1 - d.x0) / 2 : (d.y1 - d.y0) / 2;
      for (const t of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map((n) => n * (half + GAP + 1))) {
        const c = (d.dir === 'h' ? d.cx : d.cy) + t;
        if (c - half < lo + 3 || c + half > hi - 3) continue; // MAP-31: clear of the wall's corners
        const cx = d.dir === 'h' ? c : d.cx, cy = d.dir === 'h' ? d.cy : c, b = doorBox(cx, cy, d.dir, d.way);
        if (free(b)) { Object.assign(d, { cx, cy }, b); break; }
      }
      doors.push(d); take(d, 'icon');
    }
  }

  // ---- you (MAP-23: first of the marks; only the walls' doors, fixed to their walls, come before), at your own point
  const here = zones.find((x) => x.z.here);
  if (here) {
    const b = here.box, at = here.z.you ? { x: here.z.you.x * PX_PER_M * k, y: -here.z.you.y * PX_PER_M * k } : { x: b.x1 - PIN_R - 4, y: b.y0 + PIN_R + 4 };
    const p = nearFree(at.x, at.y, PIN_R, b) ?? { cx: Math.min(b.x1, Math.max(b.x0, at.x)), cy: Math.min(b.y1, Math.max(b.y0, at.y)) };
    tokens.push({ id: 'you', zoneId: here.z.id, ...p, r: PIN_R, ...disc(p.cx, p.cy, PIN_R), you: true, title: 'You are here' });
    take(disc(p.cx, p.cy, PIN_R), 'token');
    used.add('you');
  }

  // the exits that leave this map, sorted out before the labels so a label keeps off the side its zone's arrows leave by
  const all = union(zones.map((x) => x.box)), mid = { x: (all.x0 + all.x1) / 2, y: (all.y0 + all.y1) / 2 };
  const everyById = new Map(inp.every.map((z) => [z.id, z]));
  const stairList: { x: SZone; l: MapLink; up: boolean; other?: MapZone }[] = [];
  const stubs: { x: SZone; l: MapLink; side: Side; sides: Side[]; away?: string; other?: MapZone }[] = [];
  for (const x of zones) for (const l of x.z.links) {
    if (byId.has(l.to)) continue;
    const other = everyById.get(l.to);
    if ((other && other.height !== x.z.height) || (!other && !l.known && verticalOf(l.label))) { stairList.push({ x, l, up: other ? other.height > x.z.height : verticalOf(l.label) > 0, other }); continue; }
    const dir = compassOf(l.label);
    const c = { x: (x.box.x0 + x.box.x1) / 2, y: (x.box.y0 + x.box.y1) / 2 };
    const away = l.known && !other ? inp.awayName(l.to) : undefined;
    // with no compass word: the side facing away from the map's middle, else the side with the most open floor beyond it
    const fallback: Side = Math.abs(c.x - mid.x) >= Math.abs(c.y - mid.y) && (c.x !== mid.x) ? (c.x > mid.x ? 'e' : 'w') : c.y !== mid.y ? (c.y > mid.y ? 's' : 'n') : 'e';
    // the sides to try: the named one (then the two beside it), or with no compass word every side, the open one first
    const named = dir ? sideOf(dir) : fallback, near: Record<Side, Side[]> = { n: ['e', 'w'], s: ['w', 'e'], e: ['s', 'n'], w: ['n', 's'] }, back: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
    stubs.push({ x, l, side: named, sides: dir ? [named, ...near[named]] : [named, ...near[named], back[named]], ...(away ? { away } : {}), ...(other ? { other } : {}) });
  }
  // ---- zone labels (MAP-20..22): inside the top band when they fit with 6 px to spare, else outside on a leader line
  const labels: SLabel[] = [];
  const outsideSpots = (zb: Box, w: number, h: number): Box[] => {
    const out: Box[] = [], mx = (zb.x0 + zb.x1) / 2, my = (zb.y0 + zb.y1) / 2;
    for (const g of [8, 22, 40, 64]) {
      out.push({ x0: mx - w / 2, y0: zb.y0 - g - h, x1: mx + w / 2, y1: zb.y0 - g }, { x0: mx - w / 2, y0: zb.y1 + g, x1: mx + w / 2, y1: zb.y1 + g + h },
        { x0: zb.x1 + g, y0: my - h / 2, x1: zb.x1 + g + w, y1: my + h / 2 }, { x0: zb.x0 - g - w, y0: my - h / 2, x1: zb.x0 - g, y1: my + h / 2 },
        { x0: zb.x0, y0: zb.y0 - g - h, x1: zb.x0 + w, y1: zb.y0 - g }, { x0: zb.x1 - w, y0: zb.y0 - g - h, x1: zb.x1, y1: zb.y0 - g },
        { x0: zb.x0, y0: zb.y1 + g, x1: zb.x0 + w, y1: zb.y1 + g + h }, { x0: zb.x1 - w, y0: zb.y1 + g, x1: zb.x1, y1: zb.y1 + g + h },
        { x0: zb.x1 + g, y0: zb.y0 - g - h, x1: zb.x1 + g + w, y1: zb.y0 - g }, { x0: zb.x0 - g - w, y0: zb.y0 - g - h, x1: zb.x0 - g, y1: zb.y0 - g },
        { x0: zb.x1 + g, y0: zb.y1 + g, x1: zb.x1 + g + w, y1: zb.y1 + g + h }, { x0: zb.x0 - g - w, y0: zb.y1 + g, x1: zb.x0 - g, y1: zb.y1 + g + h });
    }
    return out;
  };
  /** the leader from an outside label to the nearest point of its zone */
  const leaderOf = (lb: Box, zb: Box): [number, number, number, number] => {
    const cx = (lb.x0 + lb.x1) / 2, cy = (lb.y0 + lb.y1) / 2;
    const zx = Math.min(zb.x1, Math.max(zb.x0, cx)), zy = Math.min(zb.y1, Math.max(zb.y0, cy));
    const lx = Math.min(lb.x1, Math.max(lb.x0, zx)), ly = Math.min(lb.y1, Math.max(lb.y0, zy));
    return [lx, ly, zx, zy];
  };
  // the current zone first, then the rest by size, small first (they have the fewest spots)
  const order = [...zones].sort((p, q) => (p.z.here ? -1 : q.z.here ? 1 : (p.box.x1 - p.box.x0) * (p.box.y1 - p.box.y0) - (q.box.x1 - q.box.x0) * (q.box.y1 - q.box.y0)));
  for (const x of order) {
    const zb = x.box, full = x.z.name, zw = zb.x1 - zb.x0, mx = (zb.x0 + zb.x1) / 2;
    const mk = (b: Box, lines: string[], placement: 'inside' | 'outside', isCut = false): SLabel =>
      ({ ...b, text: lines.join(' '), lines, full, cut: isCut, zoneId: x.z.id, placement, ...(placement === 'outside' ? { leader: leaderOf(b, zb) } : {}) });
    let lab: SLabel | null = null;
    // inside: on one line if it fits, else broken over two or three, in the top band
    for (let n = 1; n <= 3 && !lab; n++) {
      const lines = wrap(full, 'label', zw - 2 * PAD, n, measure);
      if (!lines || lines.length < n) continue; // fewer lines were tried already
      const { w, h } = linesBox(lines, 'label');
      if (h + 2 * PAD > zb.y1 - zb.y0) break;
      const top = zb.y0 + PAD;
      for (const y0 of [top, top + TEXT.label.line, top + 2 * TEXT.label.line]) for (const x0 of [mx - w / 2, zb.x0 + PAD, zb.x1 - PAD - w]) {
        const b = { x0, y0, x1: x0 + w, y1: y0 + h };
        if (!lab && within(b, zb, PAD) && free(b)) lab = mk(b, lines, 'inside');
      }
    }
    if (!lab) {
      // outside, on a leader line: one line, or two when long
      const lines = wrap(full, 'label', 170, 2, measure) ?? [full];
      const { w, h } = linesBox(lines, 'label'), leaves = new Set(stubs.filter((st) => st.x === x).map((st) => st.side));
      // spots off the sides this zone's exit arrows leave by come first
      const side = (b: Box): Side[] => [...(b.y1 <= zb.y0 ? ['n' as const] : []), ...(b.y0 >= zb.y1 ? ['s' as const] : []), ...(b.x0 >= zb.x1 ? ['e' as const] : []), ...(b.x1 <= zb.x0 ? ['w' as const] : [])];
      const cands = outsideSpots(zb, w, h), spots = [...cands.filter((b) => !side(b).some((q) => leaves.has(q))), ...cands.filter((b) => side(b).some((q) => leaves.has(q)))];
      const pick = spots.find((b) => free(b) && !overZone(b)) ?? spots.find((b) => free(b) && !overZone(b, x.z.id) && !hit(b, zb));
      // then over a neighbour's floor, still whole, before any cut (MAP-21)
      const over = pick ?? spots.find((b) => free(b) && !hit(b, zb));
      if (over) lab = mk(over, lines, 'outside');
    }
    if (!lab && zb.y1 - zb.y0 >= TEXT.label.h + 2 * PAD && zw >= 2 * PAD + 24) {
      // MAP-21: the last resort, cut to its zone with the full name in its tooltip
      const text = cut(full, 'label', zw - 2 * PAD, measure), { w, h } = textBox(text, 'label');
      const b = { x0: mx - w / 2, y0: zb.y0 + PAD, x1: mx + w / 2, y1: zb.y0 + PAD + h };
      if (free(b)) lab = mk(b, [text], 'inside', true);
    }
    if (!lab) {
      const text = cut(full, 'label', 140, measure), { w, h } = textBox(text, 'label');
      const spots = outsideSpots(zb, w, h), pick = spots.find((b) => free(b)) ?? spots[0];
      lab = mk(pick, [text], 'outside', text !== full);
    }
    labels.push(lab);
    take(lab, 'label');
  }

  // ---- place outlines and titles (MAP-13): the box around the place's zones plus padding, its title above the top-left corner
  const places: SPlace[] = [];
  for (const p of inp.places) {
    const zs = zones.filter((x) => p.zones.some((z) => z.id === x.z.id));
    if (!zs.length) continue;
    // padded on each side only as far as it stays off zones of somewhere else (MAP-12: a street is never drawn inside a building)
    const pad = 6 + 4 * Math.max(0, 3 - p.depth), fb = union(zs.map((x) => x.box)), others = zones.filter((x) => !zs.includes(x));
    const box = { ...fb };
    for (const [key, sign] of [['x0', -1], ['y0', -1], ['x1', 1], ['y1', 1]] as const) {
      for (const q of [pad, pad / 2, 0]) { const t = { ...box, [key]: fb[key] + sign * q }; if (q === 0 || !others.some((o) => hit(o.box, t))) { box[key] = t[key]; break; } }
    }
    const full = p.name.toUpperCase(), { w, h } = textBox(full, 'title');
    const spots: Box[] = [];
    for (let dx = 0; dx <= Math.max(0, box.x1 - box.x0 - w); dx += 12) spots.push({ x0: box.x0 + dx, y0: box.y0 - h - 3, x1: box.x0 + dx + w, y1: box.y0 - 3 });
    for (const dy of [h + 3, 2 * (h + 3)]) spots.push({ x0: box.x0, y0: box.y0 - h - 3 - dy, x1: box.x0 + w, y1: box.y0 - 3 - dy });
    spots.push({ x0: box.x0, y0: box.y1 + 3, x1: box.x0 + w, y1: box.y1 + 3 + h });
    const pick = spots.find((b) => free(b) && !overZone(b));
    let title: SText;
    if (pick) title = { ...pick, text: full, full, cut: false, lines: [full] };
    else {
      const text = cut(full, 'title', Math.max(60, box.x1 - box.x0), measure), tw = Math.ceil(measure(text, 'title')) + 2 * TEXT.title.pad;
      const alt = spots.map((b) => ({ ...b, x1: b.x0 + tw })).find((b) => free(b)) ?? { ...spots[0], x1: spots[0].x0 + tw };
      title = { ...alt, text, full, cut: text !== full, lines: [text] };
    }
    places.push({ id: p.id, name: p.name, box, title });
    take(title, 'title');
    used.add('place');
  }

  // ---- other people (MAP-22: tokens in the bottom band; at their own point when the character sees exactly where)
  for (const x of zones) {
    const zb = x.box, row = x.z.people.filter((p) => !p.at), at = x.z.people.filter((p) => p.at);
    for (const who of at) {
      const p = nearFree(who.at!.x * PX_PER_M * k, -who.at!.y * PX_PER_M * k, WHO_R, zb);
      if (p) { tokens.push({ id: `who:${who.id}`, zoneId: x.z.id, ...p, r: WHO_R, ...disc(p.cx, p.cy, WHO_R), who, title: who.name }); take(disc(p.cx, p.cy, WHO_R), 'token'); }
      else row.push(who);
    }
    row.forEach((who, i) => {
      const cx = (zb.x0 + zb.x1) / 2 + (i - (row.length - 1) / 2) * (2 * WHO_R + 4), cy = zb.y1 - WHO_R - 4;
      const p = nearFree(cx, cy, WHO_R, zb) ?? outsideNear(cx, zb.y1 + WHO_R + 4, WHO_R);
      tokens.push({ id: `who:${who.id}`, zoneId: x.z.id, ...p, r: WHO_R, ...disc(p.cx, p.cy, WHO_R), who, title: who.now ? `${who.name}: somewhere in here` : `${who.name} (last seen)` });
      take(disc(p.cx, p.cy, WHO_R), 'token');
    });
    if (x.z.people.length) used.add(x.z.people.some((p) => !p.now) ? 'who-last' : 'who');
    if (x.z.people.some((p) => p.now)) used.add('who');
  }
  /** a free spot for a disc near (cx, cy), searching outward without a zone to stay in */
  function outsideNear(cx: number, cy: number, r: number): { cx: number; cy: number } {
    for (let ring = 0; ring < 20; ring++) for (let i = 0; i < Math.max(1, 8 * ring); i++) {
      const a = (i / Math.max(1, 8 * ring)) * Math.PI * 2, x = cx + Math.cos(a) * ring * (r + GAP), y = cy + Math.sin(a) * ring * (r + GAP);
      if (free(disc(x, y, r))) return { cx: x, cy: y };
    }
    return { cx, cy };
  }

  // ---- exits to zones not on this map (MAP-24, MAP-32): an arrow out of the wall the exit's compass word names (else the
  // side facing away from the map's middle), ending at a note that names where it goes: "→ the plank gate · unexplored"
  const exits: SExit[] = [], stairs: SStair[] = [], lost: string[] = [];
  const bySide = new Map<string, typeof stubs>();
  for (const st of stubs) bySide.set(`${st.x.z.id}:${st.side}`, [...(bySide.get(`${st.x.z.id}:${st.side}`) ?? []), st]);
  for (const group of bySide.values()) group.forEach((st, i) => {
    const zb = st.x.box, l = st.l, n = group.length;
    const state = [st.away ? `to ${st.away}` : st.other ? 'known' : 'unexplored', shutWord(l.way)].filter(Boolean).join(', ');
    const full = `→ ${l.label} · ${state}`;
    // a barrier on the way out sits on the wall where the arrow leaves (MAP-33: locked shows on the door)
    const mark = l.way ? (l.way.shut ? WAY_R : 6) : 0;
    const fr = [(i + 1) / (n + 1), ...[0.5, 0.3, 0.7, 0.15, 0.85].filter((f) => n === 1 || f !== 0.5)];
    let horiz = false;
    const tryAll = (avoidZones: boolean, lines: string[]) => {
      const { w: tw, h } = linesBox(lines, 'note');
      // the barrier's mark on the wall itself, else just outside it at the arrow's foot when the wall is crowded
      for (const side of st.sides) for (const out of mark ? [0, mark + 1] : [0]) for (const len of ARROWS) for (const f of fr) {
        horiz = side === 'n' || side === 's';
        const dx = side === 'e' ? 1 : side === 'w' ? -1 : 0, dy = side === 's' ? 1 : side === 'n' ? -1 : 0;
        const x1 = horiz ? zb.x0 + (zb.x1 - zb.x0) * f : side === 'e' ? zb.x1 : zb.x0;
        const y1 = horiz ? (side === 'n' ? zb.y0 : zb.y1) : zb.y0 + (zb.y1 - zb.y0) * f;
        const mx0 = x1 + dx * out, my0 = y1 + dy * out;
        const doorAt = mark ? (l.way!.shut ? disc(mx0, my0, WAY_R) : doorBox(mx0, my0, horiz ? 'h' : 'v')) : null;
        if (doorAt && !within(horiz ? { ...doorAt, y0: zb.y0 + 3, y1: zb.y1 - 3 } : { ...doorAt, x0: zb.x0 + 3, x1: zb.x1 - 3 }, zb, 3)) continue; // clear of the corners (MAP-31)
        const sx = x1 + dx * (out + mark + 2), sy = y1 + dy * (out + mark + 2), x2 = sx + dx * len, y2 = sy + dy * len;
        const nb: Box = horiz ? { x0: x2 - tw / 2, y0: dy < 0 ? y2 - 4 - h : y2 + 4, x1: x2 + tw / 2, y1: dy < 0 ? y2 - 4 : y2 + 4 + h }
          : { x0: dx > 0 ? x2 + 4 : x2 - 4 - tw, y0: y2 - h / 2, x1: dx > 0 ? x2 + 4 + tw : x2 - 4, y1: y2 + h / 2 };
        const shaft: Box = { x0: Math.min(sx, x2) - 3, y0: Math.min(sy, y2) - 3, x1: Math.max(sx, x2) + 3, y1: Math.max(sy, y2) + 3 };
        if (!free(nb) || !free(shaft) || (doorAt && !free(doorAt)) || (avoidZones && (overZone(nb) || overZone(shaft, st.x.z.id)))) continue;
        return { x1: sx, y1: sy, x2, y2, nb, lines, doorAt, horiz };
      }
      return null;
    };
    const wrapped = wrap(full, 'note', 230, 2, measure) ?? [full];
    const got = tryAll(true, wrapped) ?? tryAll(false, wrapped) ?? (() => { const t = cut(full, 'note', 200, measure); return tryAll(false, [t]); })();
    if (!got) { lost.push(`exit:${st.x.z.id}:${l.to}`); return; }
    const made: SExit = { id: `exit:${st.x.z.id}:${l.to}`, zoneId: st.x.z.id, target: st.other ? l.to : l.label, state, x1: got.x1, y1: got.y1, x2: got.x2, y2: got.y2,
      note: { ...got.nb, text: got.lines.join(' '), lines: got.lines, full, cut: got.lines.join(' ') !== full }, ...(st.away || st.other ? { goto: l.to } : {}), ...(l.way ? { way: l.way } : {}), title: `${l.label}: ${state}` };
    exits.push(made);
    take(made.note, 'exit');
    take({ x0: Math.min(made.x1, made.x2) - 3, y0: Math.min(made.y1, made.y2) - 3, x1: Math.max(made.x1, made.x2) + 3, y1: Math.max(made.y1, made.y2) + 3 }, 'exit');
    if (got.doorAt) {
      const cx = (got.doorAt.x0 + got.doorAt.x1) / 2, cy = (got.doorAt.y0 + got.doorAt.y1) / 2;
      const d: SDoor = { id: `door:${made.id}`, cx, cy, ...got.doorAt, dir: got.horiz ? 'h' : 'v', kind: 'door', way: l.way, title: made.title, zones: [st.x.z.id] };
      doors.push(d); take(d, 'icon'); used.add('door');
    }
    used.add(st.away ? 'exit-away' : 'exit');
    if (l.way?.shut) used.add(`way:${l.way.shut}${l.way.key ? '-key' : ''}`);
  });

  // ---- stairs (icons): inside their zone, clear of its corners; just outside when the zone has no room
  for (const st of stairList) {
    const zb = st.x.box, inset = STAIR_R + 4;
    const spots = [[zb.x0 + inset, zb.y1 - inset], [zb.x1 - inset, zb.y1 - inset], [zb.x0 + inset, zb.y0 + inset], [zb.x1 - inset, zb.y0 + inset],
      [zb.x0 + inset, (zb.y0 + zb.y1) / 2], [zb.x1 - inset, (zb.y0 + zb.y1) / 2], [(zb.x0 + zb.x1) / 2, zb.y1 - inset]];
    let p: { cx: number; cy: number } | null = null;
    for (const [cx, cy] of spots) if (!p && within(disc(cx, cy, STAIR_R), zb) && free(disc(cx, cy, STAIR_R))) p = { cx, cy };
    p ??= nearFree((zb.x0 + zb.x1) / 2, zb.y1 - inset, STAIR_R, zb) ?? outsideNear(zb.x0 - STAIR_R - 6, zb.y1 - STAIR_R, STAIR_R);
    const gone = st.other ? `${st.up ? 'up' : 'down'} to ${st.other.name}` : `${st.up ? 'up' : 'down'}, unexplored`;
    stairs.push({ id: `stair:${st.x.z.id}:${st.l.to}`, zoneId: st.x.z.id, ...p, ...disc(p.cx, p.cy, STAIR_R), up: st.up, ...(st.other ? { goto: st.other.id } : {}), title: `${st.l.label}: ${gone}` });
    take(disc(p.cx, p.cy, STAIR_R), 'icon');
    used.add(st.up ? 'stairs-up' : 'stairs-down');
  }

  // ---- furniture (icons, last to place): at its own point, nudged clear of everything else; left off when its zone is full
  const furniture: SFurn[] = [], dropped: string[] = [];
  for (const x of zones) for (const f of x.z.furniture ?? []) {
    const p = nearFree(f.x * PX_PER_M * k, -f.y * PX_PER_M * k, FURN_R, x.box, FURN_R + 3);
    if (!p) { dropped.push(f.id); continue; }
    furniture.push({ id: `furn:${f.id}`, zoneId: x.z.id, kind: f.kind, name: f.name, ...p, ...disc(p.cx, p.cy, FURN_R) });
    take(disc(p.cx, p.cy, FURN_R), 'icon');
    used.add('furniture');
  }

  const bounds = union([...zones.map((x) => x.box), ...places.flatMap((p) => [p.box, p.title]), ...taken.map((t) => t.box),
    ...labels.flatMap((l) => (l.leader ? [{ x0: Math.min(l.leader[0], l.leader[2]), y0: Math.min(l.leader[1], l.leader[3]), x1: Math.max(l.leader[0], l.leader[2]), y1: Math.max(l.leader[1], l.leader[3]) }] : []))]);
  return { zones, places, labels, doors, connectors, exits, stairs, furniture, tokens, dropped, lost, used, bounds };
}

/** checks the drawn checker can't make from boxes alone, run beside it in dev views: MAP-10 every zone on the 1 m grid, and
 *  MAP-12 no zone of somewhere else inside a building's footprint (the box around its indoor zones on this floor) */
export function checkStage(zones: MapZone[], places: PlanPlace[]): string[] {
  const out: string[] = [];
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
  for (const z of zones) {
    const r = z.rect;
    if (r && !(whole(r.w) && whole(r.d) && whole(r.x - r.w / 2) && whole(r.y - r.d / 2))) out.push(`MAP-10 zone ${z.id} is off the 1 m grid (${r.w} × ${r.d} m at ${r.x}, ${r.y})`);
  }
  for (const p of places) {
    const inner = p.zones.filter((z) => !z.outdoor && z.rect);
    if (!inner.length) continue;
    const fp = union(inner.map((z) => zoneBox(z, 1)));
    for (const z of zones) if (z.rect && !p.zones.includes(z) && hit(zoneBox(z, 1), { x0: fp.x0 + 0.5, y0: fp.y0 + 0.5, x1: fp.x1 - 0.5, y1: fp.y1 - 0.5 })) out.push(`MAP-12 zone ${z.id} runs through the building ${p.id}`);
  }
  return out;
}

/** MAP-15: the known zones of a map that can't be reached from `start` through the links between them (rpg-map checkReach) */
export function checkReach(zoneIds: string[], links: [string, string][], startId: string): string[] {
  const adj = new Map(zoneIds.map((id) => [id, [] as string[]]));
  for (const [a, b] of links) { adj.get(a)?.push(b); adj.get(b)?.push(a); }
  const seen = new Set([startId]), todo = [startId];
  while (todo.length) for (const n of adj.get(todo.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  return zoneIds.filter((id) => !seen.has(id)).map((id) => `MAP-15 zone ${id} is unreachable from ${startId}`);
}
