// The stage map's layout (rpg-map MAP-10..42): from the zones the character knows on one floor, code works out where every
// mark goes, in screen pixels at the map's zoom, before anything is drawn. Zones keep their stored rectangles (metres,
// MAP-03); tokens, doors, stairs, furniture, things on the ground and exit notes are placed here so none covers another (MAP-31), yielding in the
// order MAP-23 sets. A zone's name is a background layer inside it, at one small size, that marks may sit on (MZ2, MZ4).
// Marks inside a zone keep one spot at every zoom (BG-216): each is placed once, at the widest of a few set zooms with room
// for it, and every zoom reuses that spot as a share of the zone. No DOM: map.ts draws the scene, and a measure function gives text widths (the browser's
// own in the page, an estimate in tests).
import { type MapLink, type MapPerson, type MapThingMark, type MapWay, type MapZone } from './mapData';
import { seenIn, type SeenRun } from '../plan/fog';
import { areaOf, inOutline } from '../plan/geom';
import { verticalOf } from '../scenario/heights';
import { CONFIG } from '../config';
import { HUMANOID_SIZE } from '../library/bodySize';
import { PX_PER_M, buildingCheck, cellsOf, footprint, placePad, type Box, type Footprint } from '../plan/footprint';

export { PX_PER_M, type Box };

/** the gap between an exit arrow's tip and its note, in screen pixels */
const NOTE_GAP = 9;
/** the closest the map zooms (screen pixels per map pixel) */
export const MAX_K = 2.5;
/** BG-216: the zooms marks inside zones are placed at, widest view first; a mark takes its spot at the first that has room
 *  for it, and keeps that spot (as a share of its zone) at every zoom */
export const PLACE_KS = [1, 1.6, MAX_K];
/** the dark edge drawn round a name's letters (its stroke width in .map-name), which adds to the room it needs */
const NAME_EDGE = 3;
/** the text styles the map measures: a zone's name, a place's title, an exit's note */
export type TextKind = 'label' | 'title' | 'note';
/** an exit's note, as styles.css draws .map-note text (13 px) */
const NOTE = { size: 13, weight: 600, h: 20, pad: 7, line: 15 };
/** font size, box height and side padding of each text style, in screen pixels */
export const TEXT: Record<TextKind, { size: number; weight: number; h: number; pad: number; line: number }> = {
  label: { size: NOTE.size, weight: 700, h: 18, pad: 6, line: NOTE.line }, // MAP-20 (RM24 a): every zone name at the exit notes' size
  title: { size: 13, weight: 800, h: 18, pad: 5, line: 15 }, // as styles.css draws them (13 px, LK6 a)
  note: NOTE,
};
/** the width of a text in a style at the style's size, in screen pixels; `line`: how tall the browser boxes one line of it,
 *  the font's own ascent and descent (BG-346: the checker measures that box, so the layout must too) */
export type Measure = { (text: string, kind: TextKind): number; line(kind: TextKind): { ascent: number; descent: number } };
/** a stand-in for the browser's measure where there is none (tests): a little wide and tall, so real text always fits its box */
export const roughMeasure: Measure = Object.assign((t: string, k: TextKind) => t.length * TEXT[k].size * (k === 'title' ? 0.72 : 0.6),
  { line: (k: TextKind) => ({ ascent: TEXT[k].size * 1.1, descent: TEXT[k].size * 0.35 }) });

export type SZone = { z: MapZone; box: Box };
/** box: the box round its outline; outline: its footprint as an SVG path (MAP-13) */
export type SPlace = { id: string; name: string; box: Box; outline: string; title: SText };
export type SText = Box & { text: string; full: string; cut: boolean; lines: string[] };
/** a zone's name, drawn behind every mark inside its zone (MZ2); `base`: its first line's baseline */
export type SLabel = SText & { zoneId: string; placement: 'inside'; base: number; room: Box };
/** zones: the two titles the doorway joins, the far one too when it is not on this map (MAP-85: its deck target); len: its
 *  width along its wall and thick: the wall's across it, to scale (MAP-14, RM28 a); badge: its barrier's disc on it (RM31 b:
 *  a bar's off the door's line toward the side it opens from); the box is the door's and the badge's together */
export type SDoor = Box & { id: string; cx: number; cy: number; dir: 'h' | 'v'; len: number; thick: number; kind: 'door' | 'opening'; wall: boolean; way?: MapWay;
  badge?: { cx: number; cy: number; r: number }; title: string; zones: string[] };
export type SExit = { id: string; zoneId: string; target: string; state: string; x1: number; y1: number; x2: number; y2: number; note: SText; goto?: string; way?: MapWay; title: string };
export type SStair = Box & { id: string; zoneId: string; cx: number; cy: number; up: boolean; goto?: string; title: string; label: string };
export type SFurn = Box & { id: string; zoneId: string; kind: string; name: string; cx: number; cy: number };
/** MAP-86: a thing on the ground; of: its item instance id (MAP-85's deck target), icon and kind as in MapThingMark */
export type SItem = Box & { id: string; of: string; zoneId: string; name: string; icon: MapThingMark['icon']; kind?: string; cx: number; cy: number };
/** `cap` (GSM-193; OM4b a): someone in full sight (or out of it, as last seen clearly: RX1 a) is drawn as their body's own capsule at the zoom shown, `len` px along
 *  the way they face (`deg`, screen degrees) and `wide` px across, with no smallest size; the box is the turned capsule's */
export type SToken = Box & { id: string; zoneId: string; cx: number; cy: number; r: number; you?: true; who?: MapPerson; title: string; cap?: { len: number; wide: number; deg: number };
  /** MAP-68: the faint "somewhere here" circle round the point someone out of full sight was last perceived at */
  rings?: { cx: number; cy: number; r: number }[] };
export type Scene = {
  zones: SZone[]; places: SPlace[]; labels: SLabel[]; doors: SDoor[]; exits: SExit[];
  stairs: SStair[]; furniture: SFurn[]; items: SItem[]; tokens: SToken[];
  /** furniture, things on the ground and stairs with no free spot at this zoom: hidden in place, listed in the zone's card */
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
  /** MAP-68: the people this map shows on this floor, each at their own point; one with no point is not drawn */
  people: MapPerson[];
  /** zoom: screen pixels per map pixel */
  k: number;
  measure: Measure;
  /** the name of the top-level place a known zone off this map sits in, for exits that open another map */
  awayName: (zoneId: string) => string | undefined;
  /** your body's width in metres (KnownMap.youWidthM), your pin's width (MAP-23); a person's when not given */
  youWidthM?: number;
  /** D-1558: the view origin in metres, drawn at the layout's (0, 0), so screen numbers stay small kilometres out (float
   *  precision); the world's own origin when not given */
  o?: { x: number; y: number };
};

const STAIR_R = 10, FURN_R = 9, ITEM_R = 8, WHO_R = 7;
/** your pin's shape: its disc's radius and how far its facing point reaches from its centre, in proportion (RM33 a); on a
 *  place's plan the disc is your body's width at the zoom shown (OM4b a), elsewhere this size */
export const PIN_R = 9, PIN_TIP = 15;
/** MAP-69: the share of a body's narrower side its icon takes, as the 10 px icon took of the 14 px disc */
export const WHO_ICON_SHARE = (2 * WHO_R - 4) / (2 * WHO_R);
/** gap between a mark and anything near it, a label and its zone's walls (MAP-20) */
const GAP = 2, PAD = 7; // PAD: 6 px (MAP-20) plus the hair the drawn zone sits inside its walls
/** a wall's drawn thickness, as styles.css strokes .map-edge.wall: a door is as thick across its wall (MAP-14) */
const WALL_PX = 3;
const ARROWS = [22, 40, 60, 84, 112, 144, 180];
const hit = (a: Box, b: Box, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
const disc = (cx: number, cy: number, r: number, ry = r): Box => ({ x0: cx - r, y0: cy - ry, x1: cx + r, y1: cy + ry });
const runsArea = (rs: { x0: number; x1: number; y0: number; y1: number }[]) => rs.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const union = (bs: Box[]): Box => bs.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
/** GSM-193 (SZ16; OM4b a): the capsule a body is drawn as at zoom k, its own size with no smallest */
function capsule(b: NonNullable<MapPerson['body']>, k: number): NonNullable<SToken['cap']> {
  const s = PX_PER_M * k;
  return { len: b.lengthM * s, wide: b.widthM * s, deg: (Math.atan2(-b.facing[1], b.facing[0]) * 180) / Math.PI };
}
/** half the width and height of the box around a turned capsule (its rectangle's corners, as the browser measures it) */
const half = (c: NonNullable<SToken['cap']>) => {
  const a = (c.deg * Math.PI) / 180, co = Math.abs(Math.cos(a)), si = Math.abs(Math.sin(a));
  return [(c.len * co + c.wide * si) / 2, (c.len * si + c.wide * co) / 2];
};
/** a shut way's entry in the map key */
const wayKey = (w: MapWay) => `way:${w.shut}${w.key ? '-key' : ''}`;
/** a barrier in a few words, for exit notes */
const shutWord = (w?: MapWay) => (w?.shut === 'locked' && w.key ? 'locked, your key' : w?.shut ?? '');

const O0 = { x: 0, y: 0 };
/** the zone's rectangle on screen at zoom k (y down), from the view origin o */
export function zoneBox(z: MapZone, k: number, o = O0): Box {
  const r = z.rect!, s = PX_PER_M * k;
  return { x0: r2((r.x - r.w / 2 - o.x) * s), y0: r2(-(r.y + r.d / 2 - o.y) * s), x1: r2((r.x + r.w / 2 - o.x) * s), y1: r2(-(r.y - r.d / 2 - o.y) * s) };
}

/** a text cut to fit `max` pixels with an ellipsis (MAP-21: the last resort; the full name goes in its tooltip) */
function cut(text: string, kind: TextKind, max: number, measure: Measure): string {
  if (measure(text, kind) + 2 * TEXT[kind].pad <= max) return text;
  let n = text.length;
  while (n > 1 && measure(text.slice(0, n) + '…', kind) + 2 * TEXT[kind].pad > max) n--;
  return text.slice(0, Math.max(1, n)).trimEnd() + '…';
}


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
  // BG-216: the marks inside zones are placed once, each at the widest of PLACE_KS with room for it, and every zoom reuses
  // those spots; zoomed out past where a mark was placed, it shows only where it covers nothing
  let ref: Scene | undefined;
  // MAP-25: the zone names at each of those zooms, so furniture is placed clear of them there and at every closer one
  const names = PLACE_KS.map((k) => zoneNames(inp.zones.filter((z) => z.rect).map((z) => ({ z, box: zoneBox(z, k, inp.o) })), k, inp.measure, inp.o));
  const placedAt = new Map<string, number>(); // the set zoom each piece and thing was placed at
  for (const k of PLACE_KS) {
    ref = layout({ ...inp, k }, ref, false, names);
    for (const m of [...ref.furniture, ...ref.items]) if (!placedAt.has(m.id)) placedAt.set(m.id, k);
  }
  return layout(inp, ref, true, names, placedAt);
}

/** zone names (MZ2, MAP-20): a background layer the marks may sit on, so a name takes no room and pushes no mark (BG-216) */
function zoneNames(zones: Pick<SZone, 'z' | 'box'>[], k: number, measure: Measure, o = O0): SLabel[] {
  const labels: SLabel[] = [];
  /** BG-313: the biggest seen rectangle of a title (its seen rows of one width stacked), on screen: its name sits there */
  const seenBox = (runs: SeenRun[]): Box | undefined => {
    const rects: SeenRun[] = [];
    for (const r of [...runs].sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1 || a.y0 - b.y0)) {
      const last = rects.at(-1);
      if (last && last.x0 === r.x0 && last.x1 === r.x1 && Math.abs(last.y1 - r.y0) < 1e-9) last.y1 = r.y1;
      else rects.push({ ...r });
    }
    const best = rects.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
    return best && { x0: r2((best.x0 - o.x) * PX_PER_M * k), x1: r2((best.x1 - o.x) * PX_PER_M * k), y0: r2(-(best.y1 - o.y) * PX_PER_M * k), y1: r2(-(best.y0 - o.y) * PX_PER_M * k) };
  };
  for (const x of zones) {
    if (x.z.seen && !x.z.seen.length) continue; // BG-313: a title the character has seen none of shows no name
    const room = x.z.seen ? seenBox(x.z.seen) ?? x.box : x.box, n = nameFit(x.z.name, room, measure);
    if (n) labels.push({ ...n, text: n.lines.join(' '), full: x.z.name, cut: false, zoneId: x.z.id, placement: 'inside', room });
  }
  return labels;
}

/** MAP-20, MAP-21 (RM24 a): a zone's name in box `b` at the one name size, centred, on up to three lines, 6 px clear of its
 *  walls; null when it does not fit, so it shows on hover only. Its box is the letters' as the browser boxes them (the
 *  font's ascent and descent: BG-346) plus their dark edge; `base` is its first line's baseline */
export function nameFit(full: string, b: Box, measure: Measure): (Box & { lines: string[]; base: number }) | null {
  const room = { w: b.x1 - b.x0 - 2 * PAD - NAME_EDGE, h: b.y1 - b.y0 - 2 * PAD - NAME_EDGE };
  // no plate round a name, so none of the plate's padding
  const lines = room.w > 0 ? wrap(full, 'label', room.w + 2 * TEXT.label.pad, 3, measure) : null;
  const { ascent, descent } = measure.line('label'), ink = ((lines?.length ?? 1) - 1) * TEXT.label.line + ascent + descent;
  if (!lines || ink > room.h) return null;
  const w = Math.ceil(Math.max(...lines.map((l) => measure(l, 'label')))) + NAME_EDGE, h = ink + NAME_EDGE, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, lines, base: cy - ink / 2 + ascent };
}

/** a mark's spot as a share of the room it may move in (its zone less the mark's inset), and back */
const shareOf = (v: number, a: number, b: number, inset: number) => (b - a - 2 * inset > 0 ? (v - a - inset) / (b - a - 2 * inset) : 0.5);
const fromShare = (f: number, a: number, b: number, inset: number) => (b - a - 2 * inset > 0 ? a + inset + f * (b - a - 2 * inset) : (a + b) / 2);

/** `ref`: the spots marks already have; `final`: this zoom is drawn, so a mark with no spot yet, or whose spot is covered
 *  here, is hidden (listed in `dropped`) rather than placed anew; `names`: the zone names at each of PLACE_KS; `placedAt`:
 *  the set zoom each piece and thing was placed at */
function layout(inp: PlanInput, ref: Scene | undefined, final: boolean, names: Box[][], placedAt?: Map<string, number>): Scene {
  const { k, measure } = inp, o = inp.o ?? O0;
  const zones: SZone[] = inp.zones.filter((z) => z.rect).map((z) => ({ z, box: zoneBox(z, k, o) }));
  const byId = new Map(zones.map((x) => [x.z.id, x]));
  const used = new Set<string>();
  for (const { z } of zones) {
    used.add(z.outdoor ? 'outdoor' : 'indoor');
    for (const w of z.walls ?? []) used.add(`edge:${w.cls}`);
    if (z.seen && z.sight && runsArea(z.sight) < runsArea(z.seen) - 1e-6) used.add('remembered'); // MAP-33: seen ground out of sight now
  }
  // every mark placed so far, with its role: later marks keep clear of them
  const taken: { box: Box; role: 'label' | 'token' | 'icon' | 'exit' | 'title' | 'tip' }[] = [];
  const free = (b: Box) => !taken.some((t) => hit(t.box, b, GAP));
  const overZone = (b: Box, except?: string) => zones.some((x) => x.z.id !== except && hit(x.box, b));
  const take = (box: Box, role: typeof taken[number]['role']) => { taken.push({ box, role }); return box; };
  const textBox = (text: string, kind: TextKind) => ({ w: Math.ceil(measure(text, kind)) + 2 * TEXT[kind].pad, h: TEXT[kind].h });
  const linesBox = (lines: string[], kind: TextKind) => ({ w: Math.ceil(Math.max(...lines.map((l) => measure(l, kind)))) + 2 * TEXT[kind].pad, h: TEXT[kind].h + (lines.length - 1) * TEXT[kind].line });

  const tokens: SToken[] = [];
  /** the first spot near (cx, cy) inside `zb` where a disc of radius r is free, searching outward */
  const nearFree = (cx: number, cy: number, r: number, zb: Box, inset = r + 2, ry = r, ok = free, step = r + GAP): { cx: number; cy: number } | null => {
    const lo = { x: zb.x0 + inset, y: zb.y0 + inset + ry - r }, hi = { x: zb.x1 - inset, y: zb.y1 - inset - ry + r };
    if (lo.x > hi.x || lo.y > hi.y) return null;
    const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const x0 = cl(cx, lo.x, hi.x), y0 = cl(cy, lo.y, hi.y);
    for (let ring = 0; ring * step <= 12 * (r + GAP); ring++) {
      const pts = ring === 0 ? [[0, 0]] : Array.from({ length: 8 * ring }, (_, i) => { const a = (i / (8 * ring)) * Math.PI * 2; return [Math.cos(a) * ring * step, Math.sin(a) * ring * step]; });
      for (const [dx, dy] of pts) {
        const x = cl(x0 + dx, lo.x, hi.x), y = cl(y0 + dy, lo.y, hi.y);
        if (ok(disc(x, y, r, ry))) return { cx: x, cy: y };
      }
    }
    return null;
  };
  /** BG-216: where a mark sat at the closest zoom, carried to this zoom by its share of the zone; undefined with no reference */
  const refSpots = new Map<string, { cx: number; cy: number; zoneId: string }>(ref ? [...ref.tokens, ...ref.stairs, ...ref.furniture, ...ref.items].map((m) => [m.id, m]) : []);
  const refZones = new Map((ref?.zones ?? []).map((x) => [x.z.id, x.box]));
  const spotOf = (id: string, zb: Box, inset: number): { cx: number; cy: number } | undefined => {
    const m = refSpots.get(id), rb = m && refZones.get(m.zoneId);
    if (!m || !rb) return undefined;
    return { cx: fromShare(shareOf(m.cx, rb.x0, rb.x1, inset), zb.x0, zb.x1, inset), cy: fromShare(shareOf(m.cy, rb.y0, rb.y1, inset), zb.y0, zb.y1, inset) };
  };
  /** you and people are never hidden: their own spot when it is free, else the nearest free one, only when zoomed far out */
  const keep = (p: { cx: number; cy: number } | undefined, r: number, zb: Box, ry = r, ok = free) => (!p ? undefined : ok(disc(p.cx, p.cy, r, ry)) ? p : nearFree(p.cx, p.cy, r, zb, r + 2, ry, ok) ?? outsideNear(p.cx, p.cy, r, ry, ok));
  // ---- doors (MAP-14, BG-313): each doorway the character has seen, drawn where it stands on the floor plan (Opening.at),
  // across the wall it is in: a door's leaf, a gap between posts for a way with no door, or its barrier's mark. Both titles
  // of a doorway read the same opening, drawn once.
  const doors: SDoor[] = [];
  const px = (q: { x: number; y: number }) => ({ x: r2((q.x - o.x) * PX_PER_M * k), y: r2(-(q.y - o.y) * PX_PER_M * k) });
  /** BG-313: the character has seen this doorway from title x: the fog holds the floor just inside it */
  const doorSeen = (x: SZone, l: MapLink) => !l.at || !x.z.seen || seenIn(x.z.seen, l.out ? { x: l.at.x - l.out[0] * 0.3, y: l.at.y - l.out[1] * 0.3 } : l.at);
  const drawnDoor = new Map<string, SDoor>();
  for (const x of zones) for (const l of x.z.links) {
    if (!l.at || !l.out || l.stairs || !doorSeen(x, l)) continue;
    const other = byId.get(l.to);
    if (other && other.z.height !== x.z.height) continue;
    const key = l.opening ?? `${x.z.id}>${l.to}`;
    if (drawnDoor.has(key)) continue;
    const back = other?.z.links.find((m) => m.opening === l.opening);
    const way = l.way?.shut ? l.way : back?.way?.shut ? back.way : l.way ?? back?.way;
    if (!way && !l.wall && !back?.wall) continue; // RM34 b: open ground with no door or gate has no mark; its dotted edge is the way
    const c = px(l.at), dir: 'h' | 'v' = Math.abs(l.out[1]) >= Math.abs(l.out[0]) ? 'h' : 'v';
    const kind = way ? 'door' as const : 'opening' as const;
    const title = `${l.label}: ${x.z.name} ↔ ${other?.z.name ?? l.label}${way ? ` · ${shutWord(way) || way.kind}` : ''}`;
    // MAP-14 (RM28 a): at its own width along its wall and the wall's thickness across, at every zoom, no smallest size; a
    // way with no width of its own a doorway's, as a frontier way takes (addFrontier)
    const len = (l.widthM || CONFIG.DOORWAY_M[0]) * PX_PER_M * k, [hw, hh] = dir === 'h' ? [len / 2, WALL_PX / 2] : [WALL_PX / 2, len / 2];
    const r = (len * CONFIG.MAP_DOOR_BADGE_SHARE) / 2;
    // RM31 b: a bar's badge off the line toward the side its bolt is on (l.out leads out of x; screen y runs down)
    const lean = way?.shut === 'barred' && way.side ? (way.side === x.z.id ? -1 : 1) * CONFIG.MAP_BADGE_LEAN * 2 * r : 0;
    const badge = way?.shut ? { cx: c.x + l.out[0] * lean, cy: c.y - l.out[1] * lean, r } : undefined;
    const box = union([{ x0: c.x - hw, y0: c.y - hh, x1: c.x + hw, y1: c.y + hh }, ...(badge ? [disc(badge.cx, badge.cy, r)] : [])]);
    const d: SDoor = { id: `door:${key}`, cx: c.x, cy: c.y, ...box, dir, len, thick: WALL_PX, kind, wall: !!l.wall, ...(way ? { way } : {}), ...(badge ? { badge } : {}), title, zones: [x.z.id, l.to] };
    drawnDoor.set(key, d); doors.push(d); take(d, 'icon');
    used.add(way?.shut ? 'door' : kind);
    if (way?.shut) used.add(wayKey(way));
  }
  // ---- you (MAP-23: first of the marks; only the walls' doors, fixed to their walls, come before), at your own point, at
  // your body's width at this zoom with no smallest size, never moved for another mark (OM4b a, RM29 c)
  const here = zones.find((x) => x.z.here);
  if (here) {
    const b = here.box, pr = ((inp.youWidthM ?? HUMANOID_SIZE.widthM) * PX_PER_M * k) / 2;
    // BG-356: with a point of your own, placed from it at this zoom: a spot carried as a share of the zone drifts off it
    const p = here.z.you ? { cx: (here.z.you.x - o.x) * PX_PER_M * k, cy: -(here.z.you.y - o.y) * PX_PER_M * k }
      : keep(spotOf('you', b, pr + 2), pr, b) ?? nearFree(b.x1 - pr - 4, b.y0 + pr + 4, pr, b) ?? { cx: b.x1 - pr - 4, cy: b.y0 + pr + 4 };
    tokens.push({ id: 'you', zoneId: here.z.id, ...p, r: pr, ...disc(p.cx, p.cy, pr), you: true, title: 'You are here' });
    take(disc(p.cx, p.cy, pr), 'token');
    take(disc(p.cx, p.cy, (pr * PIN_TIP) / PIN_R), 'tip'); // its facing point, whichever way you face, in proportion to its disc (RM33 a)
    used.add('you');
  }

  // the exits that leave this map (BG-313): each from its doorway, if the character has seen it, straight out of the wall
  const everyById = new Map(inp.every.map((z) => [z.id, z]));
  const stairList: { x: SZone; l: MapLink; up: boolean; other?: MapZone }[] = [];
  const stubs: { x: SZone; l: MapLink; door?: SDoor; away?: string; other?: MapZone }[] = [];
  for (const x of zones) for (const l of x.z.links) {
    if (byId.has(l.to) || (l.at && !doorSeen(x, l))) continue;
    const other = everyById.get(l.to);
    if (l.stairs || (other && other.height !== x.z.height)) { stairList.push({ x, l, up: l.up ?? (other ? other.height > x.z.height : verticalOf(l.label) > 0), other }); continue; }
    const away = l.known && !other ? inp.awayName(l.to) : undefined;
    stubs.push({ x, l, ...(l.opening && drawnDoor.has(l.opening) ? { door: drawnDoor.get(l.opening) } : {}), ...(away ? { away } : {}), ...(other ? { other } : {}) });
  }
  const labels = zoneNames(zones, k, measure, o);

  // ---- place outlines and titles (MAP-13): the place's own ground, padded and joined, its title above the top-left corner
  const places: SPlace[] = [];
  for (const p of inp.places) {
    const zs = zones.filter((x) => p.zones.some((z) => z.id === x.z.id));
    // BG-313: a place's outline goes round only the ground seen in it, so it never tells how far an unseen yard runs
    const seenBoxes = zs.flatMap((x) => (x.z.seen ? x.z.seen.map((r) => ({ x0: r2((r.x0 - o.x) * PX_PER_M * k), x1: r2((r.x1 - o.x) * PX_PER_M * k), y0: r2(-(r.y1 - o.y) * PX_PER_M * k), y1: r2(-(r.y0 - o.y) * PX_PER_M * k) })) : [x.box]));
    const fp = footprint(seenBoxes, zones.filter((x) => !zs.includes(x)).map((x) => x.box), placePad(p.depth)), top = topEdge(fp);
    if (!top) continue;
    const box = union(cellsOf(fp));
    const full = p.name.toUpperCase(), { w, h } = textBox(full, 'title');
    const spots: Box[] = [];
    for (let dx = 0; dx <= Math.max(0, top.x1 - top.x0 - w); dx += 12) spots.push({ x0: top.x0 + dx, y0: top.y - h - 3, x1: top.x0 + dx + w, y1: top.y - 3 });
    // a title wider than its outline's top edge may run out past its left corner, up to ending at the right one
    for (let dx = 12; dx < w - (top.x1 - top.x0) + 12; dx += 12) { const x0 = Math.max(top.x1 - w, top.x0 - dx); spots.push({ x0, y0: top.y - h - 3, x1: x0 + w, y1: top.y - 3 }); }
    for (const dy of [h + 3, 2 * (h + 3)]) spots.push({ x0: top.x0, y0: top.y - h - 3 - dy, x1: top.x0 + w, y1: top.y - 3 - dy });
    spots.push({ x0: box.x0, y0: box.y1 + 3, x1: box.x0 + w, y1: box.y1 + 3 + h });
    const pick = spots.find((b) => free(b) && !overZone(b));
    let title: SText;
    if (pick) title = { ...pick, text: full, full, cut: false, lines: [full] };
    else {
      const text = cut(full, 'title', Math.max(60, box.x1 - box.x0), measure), tw = Math.ceil(measure(text, 'title')) + 2 * TEXT.title.pad;
      const alt = spots.map((b) => ({ ...b, x1: b.x0 + tw })).find((b) => free(b)) ?? { ...spots[0], x1: spots[0].x0 + tw };
      title = { ...alt, text, full, cut: text !== full, lines: [text] };
    }
    places.push({ id: p.id, name: p.name, box, outline: footprintPath(fp), title });
    take(title, 'title');
    used.add('place');
  }

  // ---- other people (MAP-68; OM4b a): each at their own point, whether or not seen ground or any zone is there, and never
  // moved: they may overlap each other and any mark. In full sight, their body's own capsule at this zoom, with no smallest
  // size; out of full sight, at the point they were last seen or heard, in a "somewhere here" circle, dashed
  // RM26 b: the room a person stands in is the zone on this floor whose outline holds their point (the smallest: MAP-11
  // zones nest), whatever title lists them; over the void (no zone there) none
  const roomOf = (q: { x: number; y: number }) => zones.filter((x) => x.z.outline?.length && inOutline(q, x.z.outline, 0.01)).sort((a, b) => areaOf(a.z.outline!) - areaOf(b.z.outline!))[0];
  for (const who of inp.people) {
    const q = who.at ?? who.lastAt;
    if (!q) continue;
    const cx = (q.x - o.x) * PX_PER_M * k, cy = -(q.y - o.y) * PX_PER_M * k, zoneId = roomOf(q)?.z.id ?? '';
    // RX1 a: out of full sight, the body last seen clearly (MapPerson.body); never seen clearly, a disc of a set size
    const cap = who.body && capsule(who.body, k), [dx, dy] = cap ? half(cap) : [WHO_R, WHO_R];
    const rings = who.at ? undefined : [{ cx, cy, r: CONFIG.LAST_SEEN_RADIUS_M * PX_PER_M * k }];
    tokens.push({ id: `who:${who.id}`, zoneId, cx, cy, r: cap ? Math.min(cap.len, cap.wide) / 2 : WHO_R, ...disc(cx, cy, dx, dy), who,
      title: who.at ? who.name : `${who.name}: somewhere here`, ...(cap ? { cap } : {}), ...(rings ? { rings } : {}) });
    take(disc(cx, cy, dx, dy), 'token');
    if (!who.at) used.add('who-last');
    if (who.now) used.add('who');
  }
  /** a free spot for a disc near (cx, cy), searching outward without a zone to stay in */
  function outsideNear(cx: number, cy: number, r: number, ry = r, ok = free): { cx: number; cy: number } {
    for (let ring = 0; ring < 20; ring++) for (let i = 0; i < Math.max(1, 8 * ring); i++) {
      const a = (i / Math.max(1, 8 * ring)) * Math.PI * 2, x = cx + Math.cos(a) * ring * (r + GAP), y = cy + Math.sin(a) * ring * (r + GAP);
      if (ok(disc(x, y, r, ry))) return { cx: x, cy: y };
    }
    return { cx, cy };
  }

  // ---- exits to zones not on this map (MAP-24, MAP-32, BG-313): an arrow straight out of the wall from the exit's own
  // doorway (turned a little either way only when that is taken), ending at a note that names where it goes:
  // "the plank gate" (MAP-24)
  const exits: SExit[] = [], stairs: SStair[] = [], lost: string[] = [], dropped: string[] = [];
  for (const st of stubs) {
    const l = st.l, id = `exit:${st.x.z.id}:${l.to}`;
    if (!l.at || !l.out) { lost.push(id); continue; }
    const state = [st.away ? `to ${st.away}` : st.other ? 'known' : 'unexplored', shutWord(l.way)].filter(Boolean).join(', ');
    const full = l.label; // RM2 a: the name only; the state is in its title and the zone card
    // the arrow starts clear of its door's mark on the way out: the door's box reaches that far from its doorway
    const c = px(l.at), foot = 2 + (!st.door ? 0 : l.out[0] > 0 ? st.door.x1 - c.x : l.out[0] < 0 ? c.x - st.door.x0 : 0) * Math.abs(l.out[0])
      + (!st.door ? 0 : l.out[1] > 0 ? c.y - st.door.y0 : l.out[1] < 0 ? st.door.y1 - c.y : 0) * Math.abs(l.out[1]);
    const base = Math.atan2(-l.out[1], l.out[0]); // screen y runs down
    const tryAll = (avoidZones: boolean, lines: string[]) => {
      const { w: tw, h } = linesBox(lines, 'note');
      for (const turn of [0, 0.4, -0.4, 0.8, -0.8]) for (const len of ARROWS) {
        const dx = Math.cos(base + turn), dy = Math.sin(base + turn), side = Math.abs(dx) >= Math.abs(dy);
        const sx = c.x + dx * foot, sy = c.y + dy * foot, x2 = sx + dx * len, y2 = sy + dy * len;
        // the note stands NOTE_GAP clear of the arrow's tip, so the arrowhead never runs into its words
        const nb: Box = side ? { x0: dx > 0 ? x2 + NOTE_GAP : x2 - NOTE_GAP - tw, y0: y2 - h / 2, x1: dx > 0 ? x2 + NOTE_GAP + tw : x2 - NOTE_GAP, y1: y2 + h / 2 }
          : { x0: x2 - tw / 2, y0: dy < 0 ? y2 - NOTE_GAP - h : y2 + NOTE_GAP, x1: x2 + tw / 2, y1: dy < 0 ? y2 - NOTE_GAP : y2 + NOTE_GAP + h };
        // padded round the shaft but not back past its start, where nothing is drawn (the door's mark is, and is to scale)
        const bx = sx + dx * 3, by = sy + dy * 3, shaft: Box = { x0: Math.min(bx, x2) - 3, y0: Math.min(by, y2) - 3, x1: Math.max(bx, x2) + 3, y1: Math.max(by, y2) + 3 };
        if (!free(nb) || taken.some((t) => t.box !== st.door && hit(t.box, shaft, GAP)) || (avoidZones && (overZone(nb) || overZone(shaft, st.x.z.id)))) continue;
        return { x1: sx, y1: sy, x2, y2, nb, lines, shaft };
      }
      return null;
    };
    const wrapped = wrap(full, 'note', 230, 2, measure) ?? [full];
    const got = tryAll(true, wrapped) ?? tryAll(false, wrapped) ?? (() => { const t = cut(full, 'note', 200, measure); return tryAll(false, [t]); })();
    if (!got) { lost.push(id); continue; }
    const made: SExit = { id, zoneId: st.x.z.id, target: st.other ? l.to : l.label, state, x1: got.x1, y1: got.y1, x2: got.x2, y2: got.y2,
      note: { ...got.nb, text: got.lines.join(' '), lines: got.lines, full, cut: got.lines.join(' ') !== full }, ...(st.away || st.other ? { goto: l.to } : {}), ...(l.way ? { way: l.way } : {}), title: `${l.label}: ${state}` };
    exits.push(made);
    take(made.note, 'exit');
    take(got.shaft, 'exit');
    used.add(st.away ? 'exit-away' : 'exit');
  }

  // ---- stairs (icons, BG-313): at the stairs' own end on this floor, nudged only to keep clear of another mark
  for (const st of stairList) {
    const zb = st.x.box, inset = STAIR_R + 4, id = `stair:${st.x.z.id}:${st.l.to}`;
    const kept = spotOf(id, zb, inset);
    if (final && (!kept || !free(disc(kept.cx, kept.cy, STAIR_R)))) { dropped.push(id); continue; } // zoomed out: hidden in its own spot
    const at = st.l.at ? px(st.l.at) : { x: (zb.x0 + zb.x1) / 2, y: zb.y1 - inset };
    const p = kept ?? nearFree(at.x, at.y, STAIR_R, zb, inset) ?? outsideNear(at.x, at.y, STAIR_R);
    const gone = st.other ? `${st.up ? 'up' : 'down'} to ${st.other.name}` : `${st.up ? 'up' : 'down'}, unexplored`;
    stairs.push({ id, zoneId: st.x.z.id, ...p, ...disc(p.cx, p.cy, STAIR_R), up: st.up, ...(st.other ? { goto: st.other.id } : {}), title: `${st.l.label}: ${gone}`, label: st.l.label });
    take(disc(p.cx, p.cy, STAIR_R), 'icon');
    used.add(st.up ? 'stairs-up' : 'stairs-down');
  }

  // ---- furniture (icons, last to place): at its own point, nudged clear of everything else, zone names too; left off when
  // its zone is full, or zoomed out where it would cover a name (MAP-22, MAP-25)
  const furniture: SFurn[] = [];
  for (const l of labels) take(l, 'label');
  // placing, not drawing: clear of the names at the closer set zooms too (a zone too small for its name here may show it
  // there), each at its own size about its centre at this zoom: a name keeps its size as its zone grows (MAP-20), so a piece
  // clear of it here is clear at every closer zoom, and zooming in never covers furniture shown farther out
  if (!final) PLACE_KS.forEach((kk, i) => { if (kk > k) for (const l of names[i]) {
    const cx = ((l.x0 + l.x1) / 2) * k / kk, cy = ((l.y0 + l.y1) / 2) * k / kk, w = (l.x1 - l.x0) / 2, h = (l.y1 - l.y0) / 2;
    take({ x0: cx - w, y0: cy - h, x1: cx + w, y1: cy + h }, 'label');
  } });
  // a thing on the ground placed at a wider zoom keeps its spot (MAP-25): a piece placed nearer in stays clear of it
  if (!final) for (const x of zones) for (const t of x.z.things ?? []) { const p = spotOf(`item:${t.id}`, x.box, ITEM_R + 3); if (p) take(disc(p.cx, p.cy, ITEM_R), 'icon'); }
  // drawn, the pieces and things placed at this zoom or a wider one come first; those zoomed out past where they were placed
  // follow, shown only where they cover nothing (BG-216, MAP-25)
  const home = (id: string) => (placedAt?.get(id) ?? Infinity) <= k + 1e-9;
  const items: SItem[] = [], clear = (b: Box) => !taken.some((t) => t.role !== 'label' && hit(t.box, b, GAP));
  for (const round of final ? [true, false] : [undefined]) {
    for (const x of zones) for (const f of x.z.furniture ?? []) {
      if (x.z.seen && !seenIn(x.z.seen, f)) continue; // BG-313: furniture only where the character has seen
      if (round !== undefined && home(`furn:${f.id}`) !== round) continue;
      const kept = spotOf(`furn:${f.id}`, x.box, FURN_R + 3);
      const p = final ? (kept && free(disc(kept.cx, kept.cy, FURN_R)) ? kept : null) : kept ?? nearFree((f.x - o.x) * PX_PER_M * k, -(f.y - o.y) * PX_PER_M * k, FURN_R, x.box, FURN_R + 3);
      if (!p) { dropped.push(f.id); continue; }
      furniture.push({ id: `furn:${f.id}`, zoneId: x.z.id, kind: f.kind, name: f.name, ...p, ...disc(p.cx, p.cy, FURN_R) });
      take(disc(p.cx, p.cy, FURN_R), 'icon');
      used.add('furniture');
    }
    // ---- MAP-86: things on the ground (icons, after the furniture, so one dropped never moves a piece): placed as furniture
    // is, except that like stairs they may sit on a zone's name (MAP-22)
    for (const x of zones) for (const t of x.z.things ?? []) {
      if (x.z.seen && !seenIn(x.z.seen, t)) continue;
      const id = `item:${t.id}`, kept = spotOf(id, x.box, ITEM_R + 3);
      if (round !== undefined && home(id) !== round) continue;
      const p = final ? (kept && clear(disc(kept.cx, kept.cy, ITEM_R)) ? kept : null) : kept ?? nearFree((t.x - o.x) * PX_PER_M * k, -(t.y - o.y) * PX_PER_M * k, ITEM_R, x.box, ITEM_R + 3, ITEM_R, clear);
      if (!p) { dropped.push(t.id); continue; }
      items.push({ id, of: t.id, zoneId: x.z.id, name: t.name, icon: t.icon, ...(t.kind ? { kind: t.kind } : {}), ...p, ...disc(p.cx, p.cy, ITEM_R) });
      take(disc(p.cx, p.cy, ITEM_R), 'icon');
    }
  }

  const bounds = union([...zones.map((x) => x.box), ...places.flatMap((p) => [p.box, p.title]), ...taken.map((t) => t.box)]);
  return { zones, places, labels, doors, exits, stairs, furniture, items, tokens, dropped, lost, used, bounds };
}

/** the footprint's top side: the left end of its topmost run is the outline's top-left corner, where its title sits */
function topEdge(f: Footprint): { x0: number; x1: number; y: number } | undefined {
  const j = f.on.findIndex((row) => row.includes(true));
  if (j < 0) return undefined;
  const i0 = f.on[j].indexOf(true);
  let i1 = i0;
  while (f.on[j][i1 + 1]) i1++;
  return { x0: f.xs[i0], x1: f.xs[i1 + 1], y: f.ys[j] };
}
/** the footprint's outline as an SVG path: one closed ring of square corners round each piece (and each hole) */
export function footprintPath(f: Footprint): string {
  const at = (i: number, j: number) => !!f.on[j]?.[i];
  const next = new Map<string, [number, number][]>();
  const edge = (a: [number, number], b: [number, number]) => { const key = a.join(); if (!next.has(key)) next.set(key, []); next.get(key)!.push(b); };
  f.on.forEach((row, j) => row.forEach((c, i) => {
    if (!c) return;
    if (!at(i, j - 1)) edge([i, j], [i + 1, j]);
    if (!at(i + 1, j)) edge([i + 1, j], [i + 1, j + 1]);
    if (!at(i, j + 1)) edge([i + 1, j + 1], [i, j + 1]);
    if (!at(i - 1, j)) edge([i, j + 1], [i, j]);
  }));
  let d = '';
  for (const [start, out] of next) while (out.length) {
    const ring: [number, number][] = [];
    for (let cur = out.pop()!; ; cur = next.get(cur.join())!.pop()!) { ring.push([f.xs[cur[0]], f.ys[cur[1]]]); if (cur.join() === start) break; }
    // only the corners: a point in line with both its neighbours is dropped
    const corners = ring.filter((p, n) => { const a = ring[(n + ring.length - 1) % ring.length], b = ring[(n + 1) % ring.length]; return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); });
    d += `M${corners.map((p) => p.join(' ')).join('L')}Z`;
  }
  return d;
}
/** checks the drawn checker can't make from boxes alone, run beside it in dev views: MAP-10 every zone on the 1 m grid, and
 *  MAP-12 a building in one piece: no zone of somewhere else over its rooms, and its footprint (MAP-13, of its indoor zones'
 *  whole ground, as drawn at zoom 1) never cut in two by one */
export function checkStage(zones: MapZone[], places: PlanPlace[]): string[] {
  const out: string[] = [];
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
  for (const z of zones) {
    const r = z.rect;
    if (r && !(whole(r.w) && whole(r.d) && whole(r.x - r.w / 2) && whole(r.y - r.d / 2))) out.push(`MAP-10 zone ${z.id} is off the 1 m grid (${r.w} × ${r.d} m at ${r.x}, ${r.y})`);
  }
  for (const p of places) {
    const inner = p.zones.filter((z) => !z.outdoor && z.rect).map((z) => zoneBox(z, 1));
    if (!inner.length) continue;
    const { through, pieces } = buildingCheck(inner, zones.filter((z) => z.rect && !p.zones.includes(z)).map((z) => ({ id: z.id, b: zoneBox(z, 1) })), p.depth);
    for (const id of through) out.push(`MAP-12 zone ${id} runs through the building ${p.id}`);
    if (!through.size && pieces > 1) out.push(`MAP-12 the building ${p.id} is in ${pieces} pieces`);
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
