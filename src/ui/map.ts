// Map page: the floor plan your character has seen (PZ12 a, BG-313), drawn to scale for the place you pick: each title's
// floor, walls, doorways and furniture only where the fog says you have seen, titles named on their outlines, and every
// way out you have not taken an arrow from its own doorway. The World shows each place you know at its real extent,
// joined by the roads you know. Drag to pan, wheel or the buttons to zoom. Clicking a zone shows it in the side column.
import type { GameApi, WalkingView } from '../types';
import { h } from './kit';
import { furnIcon, furnKey } from './furnitureIcons';
import { CONFIG } from '../config';
import { buildPlayerView, distText } from '../views';
import { walkLeft } from './doing';
import { landLayer, landLabels, type LandLabel } from './landSvg';
import { lineLength, SITE_SIZES, type SiteSize } from '../land/generate';
import { ICON_ART } from './iconArt';
import { worldTiles, knownMap, pointAlong, rootPlace, type KnownMap, type MapLink, type MapPerson, type MapPlace, type MapWay, type MapZone } from './mapData';
import { cap, theName } from '../words';
import { MAX_K, PIN_R, PIN_TIP, PX_PER_M, TEXT, checkReach, checkStage, planScene, roughMeasure, type Measure, type Scene } from './mapPlan';
import { checkMap } from './mapCheck';
import { areaOf } from '../plan/geom';

/** PZ1, PZ2: a title's floor and the walls along its outline, in screen pixels: a metre point (x, y) goes to
 *  (dx + x·sc, dy − y·sc). floor is null for a plain rectangle, which keeps its box drawn a hair inside its walls (MAP-11) */
export function floorMarks(z: MapZone, sc: number, dx: number, dy: number): { floor: string | null; walls: SVGElement[] } {
  const at = (q: { x: number; y: number }) => [dx + q.x * sc, dy - q.y * sc];
  const o = z.outline ?? [], r = z.rect;
  const boxy = !r || o.length === 4 && o.every((q) => (Math.abs(q.x - (r.x - r.w / 2)) < 0.01 || Math.abs(q.x - (r.x + r.w / 2)) < 0.01) && (Math.abs(q.y - (r.y - r.d / 2)) < 0.01 || Math.abs(q.y - (r.y + r.d / 2)) < 0.01));
  const walls = (z.walls ?? []).map((w) => { const [x1, y1] = at(w.a), [x2, y2] = at(w.b); return s('line', { x1, y1, x2, y2, class: `map-edge ${w.cls}` }) as SVGElement; });
  return { floor: boxy ? null : o.map((q) => at(q).join(',')).join(' '), walls };
}

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag: string, attrs: Record<string, string | number> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};
/** a settlement's icon in the key (MAP-71) */
const kSite = (size: SiteSize, faint = '') => { const i = h('i', { class: `k-site${faint}` }); i.innerHTML = ICON_ART[size]; return i; };
/** a settlement's icon by its size, px wide, centred on x, y (MAP-71) */
const siteIcon = (size: SiteSize, x: number, y: number, px: number) => {
  const g = s('g', { class: 'map-site-icon' });
  g.innerHTML = ICON_ART[size];
  const box = { x: x - px / 2, y: y - px / 2, width: px, height: px };
  for (const [k, v] of Object.entries(box)) g.firstElementChild!.setAttribute(k, String(v));
  return g;
};

/** PZ12 a, BG-313: the fog as a clip path: the squares the character has seen of each title, in the map's screen pixels at
 *  `pxPerM` (y down), each a hair wider so the walls on a seen edge keep their whole stroke. A title with no fog record
 *  (none yet kept) shows whole. Clipping also stops a click on ground never seen. */
export function fogClip(id: string, zones: MapZone[], pxPerM: number): SVGElement {
  const pad = 1.5, rects = zones.flatMap((z) => (z.seen ?? (z.rect ? [{ x0: z.rect.x - z.rect.w / 2, x1: z.rect.x + z.rect.w / 2, y0: z.rect.y - z.rect.d / 2, y1: z.rect.y + z.rect.d / 2 }] : []))
    .map((r) => s('rect', { x: r.x0 * pxPerM - pad, y: -r.y1 * pxPerM - pad, width: (r.x1 - r.x0) * pxPerM + 2 * pad, height: (r.y1 - r.y0) * pxPerM + 2 * pad })));
  return s('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, ...rects);
}
let fogIds = 0;
/** below this stage width, fitting a place never shrinks tiles past NARROW_MIN_K */
const NARROW_W = 640, NARROW_MIN_K = 0.75;
/** SZ16: a body bigger than its token draws its footprint to scale beneath it: a capsule (its narrower side round), its
 * length along the way it faces; none for a body the token already covers, or one not seen at its own point */
export function footprintMark(cx: number, cy: number, r: number, who: MapPerson, pxPerM: number): SVGElement | null {
  const b = who.body;
  if (!b || Math.max(b.lengthM, b.widthM) * pxPerM <= 2 * r) return null;
  const L = b.lengthM * pxPerM, W = b.widthM * pxPerM, deg = (Math.atan2(-b.facing[1], b.facing[0]) * 180) / Math.PI;
  return s('rect', { class: 'map-foot', x: cx - L / 2, y: cy - W / 2, width: L, height: W, rx: Math.min(L, W) / 2, transform: `rotate(${deg} ${cx} ${cy})`, 'aria-hidden': 'true' }) as SVGElement;
}
/** the "you are here" pin, on the Map and the minimap alike; its point shows the way you face (BG-18: left and right in
 *  orders are taken from it), none before you have walked */
export function pin(cx: number, cy: number, title?: string, facing?: [number, number]) {
  const a = facing ? Math.atan2(-facing[1], facing[0]) : null, at = (d: number, r: number) => `${cx + Math.cos(a! + d) * r} ${cy + Math.sin(a! + d) * r}`;
  const g = s('g', { class: 'map-pin' }, ...(a === null ? [] : [s('path', { class: 'face', d: `M${at(0, PIN_TIP)} L${at(0.5, PIN_R)} L${at(-0.5, PIN_R)}Z` })]),
    s('circle', { cx, cy, r: PIN_R }), s('circle', { cx, cy, r: 3.5, class: 'core' }));
  if (title) { g.setAttribute('role', 'img'); g.setAttribute('aria-label', title); g.append(s('title', {}, title)); } // a mark with no visible words
  return g;
}
/** the letter a person's dot shows: the first letter of what you know them by, a name or a description ("a lean man" → L) */
export const whoInitial = (name: string) => (name.replace(/^(a|an|the)\s+/i, '').trim()[0] ?? '?').toUpperCase();
/** TV7: how far along a road you are, e.g. "1.8 km from the west end of 4.5 km" */
export const alongText = (a: NonNullable<MapZone['along']>) => `${distText(a.m)} from the ${a.from} end of ${distText(a.len)}`;
/** a height as the floor buttons and stair tips name it */
export const floorName = (m: number) => (m === 0 ? 'Ground level' : `${Math.abs(m)} m ${m > 0 ? 'up' : 'down'}`);
/** the heights a map has, lowest first: the height slider's stops */
export const mapHeights = (zones: { height: number }[]): number[] => [...new Set(zones.map((z) => z.height))].sort((a, b) => a - b);
const mode = (xs: number[]) => { const c = new Map<number, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
/** the `world` key of the World view (every top-level place as one tile) */
const WORLD = '*world*';
type Pt = { x: number; y: number };

/** a barrier on an exit in words: "door, locked", "gate, locked: you hold its key", "door, standing open" */
export function wayWords(w: MapWay): string {
  return w.shut === 'locked' && w.key ? `${w.kind}, locked: you hold its key` : w.shut ? `${w.kind}, ${w.shut}` : w.open ? `${w.kind}, standing open` : w.kind;
}
/** the marks drawn inside a barrier badge centred on x, y */
export function wayGlyph(x: number, y: number, shut: NonNullable<MapWay['shut']>): SVGElement[] {
  return shut === 'locked' ? [s('rect', { x: x - 4.5, y: y - 1, width: 9, height: 7, rx: 1.5 }), s('path', { d: `M${x - 2.75} ${y - 1}v-2.5a2.75 2.75 0 0 1 5.5 0v2.5`, fill: 'none' })]
    : shut === 'barred' ? [s('rect', { x: x - 4, y: y - 5.5, width: 8, height: 11, rx: 1, fill: 'none' }), s('line', { x1: x - 6.5, y1: y, x2: x + 6.5, y2: y })]
    : [s('line', { x1: x - 4, y1: y - 4, x2: x + 4, y2: y + 4 }), s('line', { x1: x + 4, y1: y - 4, x2: x - 4, y2: y + 4 })];
}
/** a door as a floor plan draws one: a 12 px gap across its wall, filled with a leaf (a door) or left open between two
 *  posts (a way through with no door); `dir` is the wall's run, h (east-west) or v */
export function doorGlyph(x: number, y: number, kind: 'door' | 'opening', dir: 'h' | 'v' = 'h'): SVGElement[] {
  const [w, hh] = dir === 'h' ? [12, 6] : [6, 12];
  const gap = s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, class: 'gap' });
  if (kind === 'door') return [gap, s('rect', { x: x - w / 2 + (dir === 'h' ? 1.5 : 1.5), y: y - hh / 2 + 1.5, width: w - 3, height: hh - 3, rx: 0.5, class: 'leaf' })];
  return dir === 'h' ? [gap, s('line', { x1: x - 6, y1: y - 3, x2: x - 6, y2: y + 3 }), s('line', { x1: x + 6, y1: y - 3, x2: x + 6, y2: y + 3 })]
    : [gap, s('line', { x1: x - 3, y1: y - 6, x2: x + 3, y2: y - 6 }), s('line', { x1: x - 3, y1: y + 6, x2: x + 3, y2: y + 6 })];
}
/** a barrier badge for the map's key */
const wayKey = (cls: string) => s('svg', { class: `k-way map-way ${cls}`, width: 20, height: 20, viewBox: '-10 -10 20 20', 'aria-hidden': 'true' },
  s('circle', { cx: 0, cy: 0, r: 9 }), ...wayGlyph(0, 0, cls.split(' ')[0] as NonNullable<MapWay['shut']>));

/** where the segment from a box's centre toward `to` leaves the box */
function edgeOf(c: Pt, w: number, hh: number, to: Pt): Pt {
  const dx = to.x - c.x, dy = to.y - c.y;
  if (!dx && !dy) return c;
  const t = Math.min(Math.abs((w / 2 + 6) / (dx || 1e-9)), Math.abs((hh / 2 + 6) / (dy || 1e-9)));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** the order "Move to here" types into the action box: the zone by its name, with "the" before a plain one */
export const moveOrder = (name: string): string => `I go to ${/^(the|a|an)\s/i.test(name) || /^[A-Z]/.test(name) ? name : `the ${name}`}`;

/** an exit you have not taken, as an order: "back out to the road" reads "I go back out to the road", "the hut door"
 *  reads "I go to the hut door" */
export const exitOrder = (label: string): string =>
  /^(back|out|up|down|through|into|in|toward|towards|across|over|past|along|onto|on|to|north|south|east|west|behind|under|outside|inside|around)\b/i.test(label) ? `I go ${label}` : moveOrder(label);

/** onMove: "Move to here" on a zone's or an unexplored exit's card hands its order to Play's action box (typed, not sent) */
export function mapPage(api: GameApi, onMove?: (order: string) => void) {
  const el = h('main', { class: 'map-page' });
  // one map per top-level place (a "world"): the village, the tavern in it and the field beside it share one layout,
  // each inner place drawn as an outlined area. `focus` is the place picked in the list or the crumbs.
  let focus = '', selected = '', lastHere = '';
  /** an unexplored exit picked on the map: its card offers Move to here */
  let exitSel: { zoneId: string; label: string } | null = null;
  /** what makes an unexplored exit clickable: the zone it leaves and its words */
  const exitAttrs = (zoneId: string, label: string) => ({ 'data-exit': label, 'data-exit-from': zoneId, tabindex: 0, role: 'button', 'aria-label': `${label}: unexplored, click for Move to here` });
  const spots = new Map<string, Map<string, Pt>>(); // per world
  const views = new Map<string, { x: number; y: number; k: number }>(); // per world pan and zoom
  let cur: KnownMap | null = null, world = '';
  let facing: [number, number] | undefined; // the pin's point (BG-18)
  let walk: WalkingView | undefined; // AT49: the zone the player's walk is still headed for
  const floors = new Map<string, number>(); // per world: the height shown
  // To scale (CO1, CO9, BG-313): each title, and in World each place, at its real position and size in metres
  /** a place's own map: the rpg-map stage map, laid out by mapPlan */
  const planMap = () => world !== WORLD;
  const tw = (z: MapZone) => (z.rect ? z.rect.w * PX_PER_M : 0);
  const th = (z: MapZone) => (z.rect ? z.rect.d * PX_PER_M : 0);

  const svg = s('svg', { class: 'map-svg', role: 'img' }) as SVGSVGElement;
  const vp = s('g', { class: 'map-vp' }) as SVGGElement;
  const defs = s('defs', {},
    s('pattern', { id: 'map-dots', width: 28, height: 28, patternUnits: 'userSpaceOnUse' }, s('circle', { cx: 2, cy: 2, r: 1.2, class: 'map-dot' })),
    s('pattern', { id: 'map-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('line', { x1: 0, y1: 0, x2: 0, y2: 7, class: 'map-hatch-line' })),
    s('marker', { id: 'map-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 10 5 0 10z', class: 'map-arrowhead' })));
  const bg = s('rect', { x: -6000, y: -6000, width: 12000, height: 12000, fill: 'url(#map-dots)', class: 'map-bg' });
  // to scale, your pin sits on its own layer at a fixed size, so it stays visible however far out a long road zooms (TV7)
  const youLayer = s('g', { class: 'map-you' }) as SVGGElement;
  let youAt: (Pt & { title: string }) | null = null;
  // to scale, the World's place names sit on their own layer at a fixed size, at each place's north-west corner, so they
  // stay readable when kilometres of road zoom the map far out
  const nameLayer = s('g', { class: 'map-world-names' }) as SVGGElement;
  let worldNames: { x: number; y: number; y1?: number; name: string; sub: string; here: boolean; mid?: true; alt?: (Pt & { steep: boolean })[]; icon?: SiteSize }[] = [];
  // WZ4, to scale: the land you have made out lies under the World's places and roads, in metres like them. Each region's
  // markup is large, so it is built once per region and cells seen, and panning or zooming only moves it
  const landNodes = new Map<string, SVGGElement>();
  let landG: SVGGElement | null = null, landPx = 0;
  /** the settlements and landmarks on that land, on the name layer at a fixed size; a place drawn as a World tile is its own mark */
  let landNames: LandLabel[] = [];
  // to scale, a place's map is laid out by code at the zoom shown (mapPlan, rpg-map): zones, doors, labels, people and exit
  // notes on one layer in screen pixels, so no label or mark covers another at any zoom; panning only moves it
  const planLayer = s('g', { class: 'map-plan' }) as SVGGElement;
  let scene: Scene | null = null, sceneK = 0;
  const fogId = `map-fog-${++fogIds}`;
  svg.append(defs, vp, planLayer, nameLayer, youLayer);
  const stage = h('div', { class: 'map-stage' });
  const side = h('aside', { class: 'map-side', 'aria-label': 'Map details' });
  const crumbs = h('nav', { class: 'map-crumbs', 'aria-label': 'Place' });
  const empty = h('p', { class: 'map-empty' });
  const zoomBtn = (label: string, title: string, f: () => void) => h('button', { type: 'button', class: 'map-btn', title, 'aria-label': title, onclick: f }, label);
  const tools = h('div', { class: 'map-tools' },
    zoomBtn('+', 'Zoom in', () => zoomBy(1.25)), zoomBtn('−', 'Zoom out', () => zoomBy(0.8)),
    zoomBtn('◎', 'Find me', () => findMe()), zoomBtn('⤢', 'Show the whole map', () => fit(world)));
  const floorBar = h('nav', { class: 'map-floors', 'aria-label': 'Floor' });
  stage.append(svg, crumbs, tools, floorBar, empty);

  const placeOf = (id: string) => cur?.places.find((p) => p.id === id);
  // RD2: a road is only a line on the World map, never a map of its own; a place along it (a waystation) is its own map
  const isRoad = (id: string) => placeOf(id)?.kind === 'road';
  const rootOf = (id: string) => (cur ? rootPlace(cur, id) : id);
  /** the map a place is drawn on: its top-level place's, or the World zoomed to the road when it is a road (RD1) */
  const mapOf = (id: string) => (isRoad(rootOf(id)) ? WORLD : rootOf(id));
  /** Move to here's order for a zone; a zone in another town or building than the one you are in names it, so the order
   *  can't be read as a spot nearby ("I go to the village square in Thornbury") */
  const moveHere = (z: MapZone): string => {
    const to = rootOf(z.placeId), name = placeOf(to)?.name;
    return cur && name && rootOf(cur.placeId) !== to && name.toLowerCase() !== z.name.toLowerCase() ? `${moveOrder(z.name)} in ${theName(name)}` : moveOrder(z.name);
  };
  const inside = (id: string, anc: string) => { for (let p = placeOf(id), n = 0; p && n < 20; p = p.parentId ? placeOf(p.parentId) : undefined, n++) if (p.id === anc) return true; return false; };
  const allZones = () => (cur?.places ?? []).flatMap((p) => p.zones);
  // WORLD: every top-level place as one tile, joined by the roads you know (worldTiles); any other `world` is a place's own map
  let tilesOfWorld: MapZone[] = [];
  const floor = () => floors.get(world) ?? 0;
  /** the zones drawn now: the world's zones at the shown height */
  const floorZones = () => worldZones().filter((z) => world === WORLD || z.height === floor());
  const worldZones = () => (world === WORLD ? tilesOfWorld : (cur?.places ?? []).filter((p) => rootOf(p.id) === world).flatMap((p) => p.zones));

  // ---------- pan and zoom
  const view = () => views.get(world) ?? { x: 0, y: 0, k: 1 };
  /** how far out the map zooms: to scale the World can span kilometres (a day's road is 30 km), so it may zoom out until
   *  the whole World fits */
  const minK = () => {
    if (world !== WORLD) return 0.2;
    const b = bounds(WORLD), r = svg.getBoundingClientRect();
    return b && r.width ? Math.min(0.005, fitK(b, r) * 0.8) : 0.005;
  };
  /** to scale, the World's names run right from each place's north-west corner at a fixed size: room kept for them */
  const nameRoom = () => (world === WORLD ? 160 : 0);
  /** the zoom that fits a box in the stage, below the crumbs */
  const fitK = (b: { x0: number; y0: number; x1: number; y1: number }, r: DOMRect) => Math.min((r.width - 48 - nameRoom()) / (b.x1 - b.x0), (r.height - 130) / (b.y1 - b.y0));
  const apply = () => {
    const v = view();
    vp.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
    // a place's name sits inside its north-west corner; a road's name centred above its middle, so it never sits on the
    // place at its end
    // the land's lines keep a set width on screen: --px is metres per screen pixel
    const px = 1 / (v.k * PX_PER_M);
    if (landG && px !== landPx) { landG.style.setProperty('--px', String(px)); landPx = px; }
    const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
    if (youAt && !planMap()) { const x = v.x + youAt.x * v.k, y = v.y + youAt.y * v.k; taken.push({ x0: x - 11, y0: y - 11, x1: x + 11, y1: y + 11 }); }
    // places' names first, then roads' (MAP-23): a road's name takes the first spot along it that covers no other name and
    // not your pin, and is left out (its line keeps it in its tooltip) when none is free at this zoom
    const r = svg.getBoundingClientRect(), hits = (b: (typeof taken)[number]) => taken.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1);
    const names = [...worldNames.filter((n) => !n.mid), ...worldNames.filter((n) => n.mid)].flatMap((n) => {
      // a place too small on screen to hold its name (a village kilometres from the next) has it just under its south side
      const tall = ((n.y1 ?? n.y) - n.y) * v.k, under = !n.mid && tall < 40, ic = n.icon ? 28 : 0, wd = Math.max(n.name.length * 8, n.sub.length * 7.5) + ic;
      // a road's name sits above a stretch that runs east-west, and beside one that runs north-south
      const spot = (n.alt ?? [{ ...n, steep: false }]).map((q) => {
        const x = v.x + q.x * v.k + (q.steep ? 14 : n.mid || under ? 0 : 8), y = v.y + q.y * v.k + (q.steep ? -4 : n.mid ? -34 : under ? tall + 18 : 18), c = n.mid && !q.steep;
        return { x, y, c, box: { x0: c ? x - wd / 2 : x, y0: y - 14, x1: c ? x + wd / 2 : x + wd, y1: y + 20 } };
      }).find((q) => !n.mid || !hits(q.box));
      if (!spot || spot.box.x1 < 0 || spot.box.y1 < 0 || spot.box.x0 > r.width || spot.box.y0 > r.height) return []; // off the map
      taken.push(spot.box);
      const { x, y } = spot, anchor: Record<string, string> = spot.c ? { 'text-anchor': 'middle' } : {};
      return [s('g', { class: `map-world-name${n.here ? ' here' : ''}${n.mid ? ' road' : ''}`, 'data-role': 'label', 'data-id': `world:${n.name}` },
        ...(n.icon ? [siteIcon(n.icon, x + 11, y + 2, 24)] : []),
        s('text', { x: x + ic, y, class: 'map-tile-name', ...anchor }, n.name), s('text', { x: x + ic, y: y + 16, class: 'map-tile-sub', ...anchor }, n.sub))];
    });
    nameLayer.replaceChildren(...names, ...landMarksAt(v, taken));
    youLayer.replaceChildren(...(youAt && !planMap() ? [pin(v.x + youAt.x * v.k, v.y + youAt.y * v.k, youAt.title, facing)] : []));
    if (planMap()) {
      if (!scene || Math.abs(v.k - sceneK) > 1e-9) renderPlan(v.k);
      planLayer.setAttribute('transform', `translate(${v.x} ${v.y})`);
    } else { planLayer.replaceChildren(); scene = null; }
  };
  const setView = (v: { x: number; y: number; k: number }) => { views.set(world, v); apply(); };
  /** the land's settlements and landmarks on screen: its size's icon (a diamond for a landmark) with its name above; one that would
   *  cover a place's name, your pin or a bigger settlement's name, or lies off the map, is left out (MAP-23) */
  function landMarksAt(v: { x: number; y: number; k: number }, taken: { x0: number; y0: number; x1: number; y1: number }[]) {
    const r = svg.getBoundingClientRect(), R = { town: 10, village: 9, hamlet: 7.5, feature: 4 };
    const out: SVGElement[] = [];
    for (const l of landNames) {
      const x = v.x + l.at.x * PX_PER_M * v.k, y = v.y - l.at.y * PX_PER_M * v.k, w = l.name.length * 6.6, rr = R[l.kind];
      const box = { x0: Math.min(x - rr, x - w / 2), y0: y - rr - 18, x1: Math.max(x + rr, x + w / 2), y1: y + rr };
      if (box.x0 < 0 || box.y0 < 0 || box.x1 > r.width || box.y1 > r.height || taken.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
      taken.push(box);
      const said = `${l.name}${l.kind === 'feature' ? '' : `, a ${l.kind}`}${l.faint ? ': known by word, not seen' : ''}`;
      out.push(s('g', { class: `map-land-mark ${l.kind}${l.faint ? ' faint' : ''}`, 'data-role': 'label', 'data-id': `land:${l.id}`, role: 'img', 'aria-label': said },
        l.kind === 'feature' ? s('rect', { x: x - rr, y: y - rr, width: 2 * rr, height: 2 * rr, transform: `rotate(45 ${x} ${y})` }) : siteIcon(l.kind, x, y, 2 * rr),
        s('text', { x, y: y - rr - 5, 'text-anchor': 'middle' }, l.name), s('title', {}, said)));
    }
    return out;
  }
  // names are sized from measured text: once the map's own font has loaded, measure and lay the plan out again
  document.fonts?.ready.then(() => { if (planMap() && scene) { scene = null; apply(); } });
  function zoomBy(f: number, at?: Pt) {
    const v = view(), r = svg.getBoundingClientRect();
    const c = at ?? { x: r.width / 2, y: r.height / 2 };
    const k = Math.max(minK(), Math.min(MAX_K, v.k * f));
    setView({ k, x: c.x - (c.x - v.x) * (k / v.k), y: c.y - (c.y - v.y) * (k / v.k) });
  }
  /** the box around a place's zones (and the places inside it), stubs included */
  function bounds(placeId: string): { x0: number; y0: number; x1: number; y1: number } | null {
    const sp = spots.get(world);
    const zs = floorZones().filter((z) => placeId === WORLD || inside(z.placeId, placeId));
    if (!zs.length || !sp) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const z of zs) { const p = sp.get(z.id); if (!p) continue; const w = tw(z) / 2, hh = th(z) / 2; x0 = Math.min(x0, p.x - w); x1 = Math.max(x1, p.x + w); y0 = Math.min(y0, p.y - hh); y1 = Math.max(y1, p.y + hh); }
    return { x0, y0, x1, y1 };
  }
  function fit(placeId: string) {
    if (planMap()) { fitPlan(placeId); return; }
    const b = world === WORLD && isRoad(placeId) ? roadBounds(placeId) : bounds(placeId), r = svg.getBoundingClientRect();
    if (!b || !r.width) return;
    const top = 60; // the crumbs sit over the top edge
    const k = Math.max(minK(), Math.min(1.1, fitK(b, r)));
    // a narrow screen keeps tiles readable: a floor on the scale, centred on you when you are in this place
    const me = cur ? spots.get(world)?.get(cur.zoneId) : undefined;
    if (k < NARROW_MIN_K && r.width < NARROW_W) {
      const at = me && inside(cur!.placeId, placeId) ? me : { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
      setView({ k: NARROW_MIN_K, x: r.width / 2 - at.x * NARROW_MIN_K, y: top + (r.height - top - 70) / 2 - at.y * NARROW_MIN_K });
      return;
    }
    const c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
    setView({ k, x: (r.width - nameRoom()) / 2 - c.x * k, y: top + (r.height - top - 70) / 2 - c.y * k });
  }
  /** RD1: a road in the World with the places at its ends and along it, so you see where it runs from and to */
  function roadBounds(id: string) {
    const t = tilesOfWorld.find((z) => z.id === id);
    const all = [id, ...(t?.links.map((l) => l.to) ?? [])].map(bounds).filter((x): x is NonNullable<typeof x> => !!x);
    return all.length ? { x0: Math.min(...all.map((x) => x.x0)), y0: Math.min(...all.map((x) => x.y0)), x1: Math.max(...all.map((x) => x.x1)), y1: Math.max(...all.map((x) => x.y1)) } : null;
  }
  const hereZone = () => allZones().find((z) => z.id === cur?.zoneId);
  function centre(zoneId: string) {
    const p = (zoneId === cur?.zoneId && youAt) || spots.get(world)?.get(zoneId), r = svg.getBoundingClientRect();
    if (!p || !r.width) return;
    const k = view().k;
    setView({ k, x: r.width / 2 - p.x * k, y: r.height / 2 - p.y * k });
  }
  function findMe() {
    if (!cur) return;
    if (world === WORLD) { centre(rootOf(cur.placeId)); return; }
    focus = cur.placeId; selected = cur.zoneId; setFloorOf(cur.zoneId); draw(); centre(cur.zoneId);
  }
  let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
  svg.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; const v = view(); drag = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false }; });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; svg.setPointerCapture(e.pointerId); svg.classList.add('grabbing'); }
    setView({ ...view(), x: drag.vx + dx, y: drag.vy + dy });
  });
  const endDrag = () => { svg.classList.remove('grabbing'); setTimeout(() => { drag = null; }); };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, { x: e.clientX - r.left, y: e.clientY - r.top }); }, { passive: false });
  const pick = (t: Element | null) => {
    const z = t?.closest('[data-zone]'), a = t?.closest('[data-area]'), g = t?.closest('[data-goto]'), x = t?.closest('[data-exit]');
    exitSel = null;
    if (x) { selected = x.getAttribute('data-exit-from')!; exitSel = { zoneId: selected, label: x.getAttribute('data-exit')! }; draw(); }
    else if (g) goTo(g.getAttribute('data-goto')!);
    else if (z && world === WORLD && isRoad(z.getAttribute('data-zone')!)) { selected = focus = z.getAttribute('data-zone')!; draw(); } // RD2: its card
    else if (z && world === WORLD) show(z.getAttribute('data-zone')!);
    else if (z) { selected = z.getAttribute('data-zone')!; focus = worldZones().find((x) => x.id === selected)?.placeId ?? focus; draw(); }
    else if (a) { focus = a.getAttribute('data-area')!; draw(); }
  };
  svg.addEventListener('click', (e) => { if (!drag?.moved) pick(e.target as Element); });
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e.target as Element); } });

  // ---------- drawing
  type Box = { x0: number; y0: number; x1: number; y1: number };
  function drawMap() {
    // every map is to scale (BG-313): each title, or in the World each place, at its real spot in metres
    const every = worldZones().filter((z) => z.rect), zones = floorZones().filter((z) => z.rect);
    const sp = new Map(every.map((z) => [z.id, { x: z.rect!.x * PX_PER_M, y: -z.rect!.y * PX_PER_M }]));
    spots.set(world, sp);
    if (planMap()) {
      // the layer above draws it all at the zoom shown (apply → renderPlan)
      vp.replaceChildren(bg); scene = null;
      drawFloors();
      const here = zones.find((z) => z.here && z.you);
      youAt = here ? { x: here.you!.x * PX_PER_M, y: -here.you!.y * PX_PER_M, title: here.along ? alongText(here.along) : 'You are here' } : null;
      svg.setAttribute('aria-label', `Map of ${placeOf(world)?.name ?? 'this place'}: ${zones.length} zone${zones.length === 1 ? '' : 's'} known`);
      return;
    }
    // RD1: the World shows you at your own point, on a road or in a village
    const hz = hereZone();
    if (hz?.you && hz.rect) {
      // on a road bound to the land, at your point along its line
      const at = hz.line && hz.along ? pointAlong(hz.line, hz.along.m) : hz.you;
      youAt = { x: at.x * PX_PER_M, y: -at.y * PX_PER_M, title: hz.along ? `You: ${alongText(hz.along)}` : 'You are here' };
    }
    landG = drawLand(); landPx = 0;
    const byId = new Map(zones.map((z) => [z.id, z]));
    const links = s('g', { class: 'map-links' }), tiles = s('g', { class: 'map-tiles' }), labels = s('g', { class: 'map-labels' });
    const done = new Set<string>();
    for (const z of zones) {
      const a = sp.get(z.id)!;
      for (const l of z.links) {
        const to = byId.get(l.to);
        if (!to) continue; // a place known by word only has no extent to draw
        const key = [z.id, l.to].sort().join('>');
        if (done.has(key)) continue;
        done.add(key);
        const b = sp.get(l.to)!, p1 = edgeOf(a, tw(z), th(z), b), p2 = edgeOf(b, tw(to), th(to), a);
        links.append(s('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'map-link road' }, s('title', {}, `${l.label}: ${z.name} ↔ ${to.name}`)));
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > l.label.length * 6.6 + 40) labels.append(pill((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, l.label));
      }
    }
    for (const z of zones) tiles.append(worldPlanTile(z, sp.get(z.id)!, z.here ? 'You are here' : z.look));
    drawFloors();
    labels.append(scaleBar(zones, sp));
    vp.replaceChildren(bg, ...(landG ? [landG] : []), links, tiles, labels);
    svg.setAttribute('aria-label', `The world as you know it: ${zones.length} place${zones.length === 1 ? '' : 's'}`);
  }
  /** WZ4: the land you have made out, each region's markup from its cache; and its settlements and landmarks for the name
   *  layer, less those drawn as a World tile */
  function drawLand(): SVGGElement {
    const g = s('g', { class: 'map-land', transform: `scale(${PX_PER_M})`, 'aria-hidden': 'true' }) as SVGGElement;
    const land = cur?.land ?? [], keep = new Set(land.map((l) => l.key));
    for (const k of [...landNodes.keys()]) if (!keep.has(k)) landNodes.delete(k);
    for (const l of land) {
      let n = landNodes.get(l.key);
      if (!n) { n = s('g') as SVGGElement; n.innerHTML = landLayer(l.region, l); landNodes.set(l.key, n); }
      g.append(n);
    }
    const tiled = new Set(tilesOfWorld.map((t) => t.id)), rank = { town: 0, village: 1, hamlet: 2, feature: 3 };
    landNames = land.flatMap((l) => landLabels(l.region, l)).filter((x) => x.name && !(x.placeId && tiled.has(rootOf(x.placeId)))).sort((a, b) => rank[a.kind] - rank[b.kind]);
    return g;
  }
  // ---------- the stage map to scale (rpg-map): code lays out every mark (mapPlan), then this draws it, then dev views check it
  let measureCtx: CanvasRenderingContext2D | null | undefined;
  /** the browser's width of a text in a map style (MAP-51: real sizes, so the layout and the check agree) */
  const measure: Measure = (t, kind, px) => {
    if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
    if (!measureCtx) return roughMeasure(t, kind, px);
    const st = TEXT[kind];
    // zone names are drawn in the rounded face (.map-name), the rest in the map's own
    const face = kind === 'label' ? getComputedStyle(svg).getPropertyValue('--font-round').trim() : '';
    measureCtx.font = `${st.weight} ${px ?? st.size}px ${face || getComputedStyle(svg).fontFamily || 'sans-serif'}`;
    return measureCtx.measureText(t).width + (kind === 'title' ? t.length * (px ?? st.size) * 0.06 : 0); // titles: .06em tracking
  };
  const innerPlaces = (zones: MapZone[]) => (cur?.places ?? []).filter((p) => rootOf(p.id) === world && p.id !== world).sort((a, b) => a.depth - b.depth)
    .map((p) => ({ id: p.id, name: p.name, depth: p.depth, zones: zones.filter((z) => inside(z.placeId, p.id)) })).filter((p) => p.zones.length);
  const sceneAt = (k: number) => planScene({ zones: floorZones(), every: worldZones(), places: innerPlaces(floorZones()), k, measure, visits: new Set(cur?.visited ?? []),
    awayName: (id) => { const z = allZones().find((x) => x.id === id); return z ? placeOf(rootOf(z.placeId))?.name : undefined; } });
  /** the scale bar under the map, in screen pixels: 10 m and its paces */
  // the scale bar ends under the drawing's right edge, clear of the Height panel at the bottom left
  const barOf = (sc: Scene, k: number) => ({ x: Math.max(sc.bounds.x0, sc.bounds.x1 - 10 * PX_PER_M * k - 120), y: sc.bounds.y1 + 22, len: 10 * PX_PER_M * k });
  function fitPlan(placeId: string) {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const top = 60, bottom = 64, edge = 20, aw = r.width - 2 * edge, ah = r.height - top - bottom;
    const zs = floorZones().filter((z) => inside(z.placeId, placeId));
    const zb = (zs.length ? zs : floorZones()).map((z) => z.rect!);
    const w = Math.max(...zb.map((q) => q.x + q.w / 2)) - Math.min(...zb.map((q) => q.x - q.w / 2)), d = Math.max(...zb.map((q) => q.y + q.d / 2)) - Math.min(...zb.map((q) => q.y - q.d / 2));
    let k = Math.max(minK(), Math.min(MAX_K, aw / (w * PX_PER_M), ah / (d * PX_PER_M)));
    let sc = sceneAt(k);
    // the marks around the zones (labels outside, exit notes, titles) take room too: shrink until all of it fits
    for (let i = 0; i < 8; i++) {
      const bw = sc.bounds.x1 - sc.bounds.x0, bh = sc.bounds.y1 - sc.bounds.y0 + 34;
      if (bw <= aw && bh <= ah) break;
      k = Math.max(minK(), k * Math.min(aw / bw, ah / bh) * 0.96);
      sc = sceneAt(k);
    }
    const bw = sc.bounds.x1 - sc.bounds.x0, bh = sc.bounds.y1 - sc.bounds.y0 + 34;
    const onRoad = youAt && hereZone()?.along && cur && inside(cur.placeId, placeId);
    if (onRoad) { setView({ k, x: r.width / 2 - youAt!.x * k, y: top + ah / 2 - youAt!.y * k }); return; }
    setView({ k, x: edge + (aw - bw) / 2 - sc.bounds.x0, y: top + Math.max(0, (ah - bh) / 2) - sc.bounds.y0 });
  }
  function renderPlan(k: number) {
    const sc = sceneAt(k);
    scene = sc; sceneK = k;
    // BG-313: floors and walls only where the fog says the character has seen
    const fog = fogClip(fogId, sc.zones.map((x) => x.z), PX_PER_M * k);
    const zoneG = s('g', { class: 'map-zones', 'clip-path': `url(#${fogId})` }), marks = s('g', { class: 'map-marks' });
    const zoneById = new Map(sc.zones.map((x) => [x.z.id, x]));
    const areas = sc.places.map((p) => {
      const on = p.id === focus, mine = !!cur && inside(cur.placeId, p.id);
      return s('g', { class: `map-area real${on ? ' on' : ''}${mine ? ' mine' : ''}`, 'data-area': p.id, tabindex: 0, role: 'button', 'aria-label': `${p.name}: a place on this map` },
        s('rect', { x: p.box.x0, y: p.box.y0, width: p.box.x1 - p.box.x0, height: p.box.y1 - p.box.y0, 'data-role': 'place', 'data-id': p.id }));
    });
    for (const x of sc.zones) zoneG.append(planZone(x.z, x.box, x.state));
    // MZ2: each zone's name behind every mark, in bold letters sized to its box (data-layer back: marks may sit on it)
    const names = s('g', { class: 'map-names', 'aria-hidden': 'true' }, ...sc.labels.map((l) => {
      const x = (l.x0 + l.x1) / 2, first = (l.y0 + l.y1) / 2 - ((l.lines.length - 1) * l.line) / 2 + l.size * 0.36; // centred on the box
      return s('text', { class: `map-name${zoneById.get(l.zoneId)?.z.here ? ' here' : ''}`, x, y: first, 'text-anchor': 'middle', 'font-size': l.size,
        'data-role': 'label', 'data-layer': 'back', 'data-id': `label:${l.zoneId}`, 'data-for': l.zoneId, 'data-placement': 'inside' },
      ...l.lines.map((line, i) => s('tspan', { x, y: first + i * l.line }, line)));
    }));
    const textMark = (b: { x0: number; y0: number; x1: number; y1: number; full: string; cut: boolean; lines: string[] }, cls: string, attrs: Record<string, string | number>, kind: 'label' | 'title' | 'note') => {
      const st = TEXT[kind], first = (b.y0 + b.y1) / 2 - ((b.lines.length - 1) * st.line) / 2 + st.size * 0.36, x = (b.x0 + b.x1) / 2;
      return s('g', { class: cls, ...attrs, ...(b.cut ? { 'aria-label': b.full } : {}) },
        s('rect', { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, rx: kind === 'note' ? 9 : 4 }),
        s('text', { x, y: first, 'text-anchor': 'middle' }, ...b.lines.map((line, i) => s('tspan', { x, y: first + i * st.line }, line))),
        ...(b.cut ? [s('title', {}, b.full)] : []));
    };
    for (const d of sc.doors) marks.append(doorMark(d));
    for (const p of sc.places) marks.append(textMark(p.title, `map-place-title${p.id === focus ? ' on' : ''}`, { 'data-role': 'label', 'data-id': `place:${p.id}`, 'data-for': p.id, 'data-placement': 'outside', 'data-area': p.id }, 'title'));
    for (const e of sc.exits) {
      const open = e.goto ? {} : exitAttrs(e.zoneId, e.target); // unexplored: click for its card and Move to here
      const on = exitSel?.zoneId === e.zoneId && exitSel.label === e.target ? ' picked' : '';
      marks.append(s('g', { class: `map-exit${e.goto ? ' away' : ' open'}${e.zoneId === selected ? ' hot' : ''}${on}`, 'data-role': 'exit', 'data-id': e.id, 'data-target': e.target, ...(e.goto ? { 'data-goto': e.goto } : open) },
        s('line', { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, 'marker-end': 'url(#map-arrow)' }), s('title', {}, e.title)));
      marks.append(textMark(e.note, `map-note${e.goto ? ' away' : ' open'}${e.way?.shut ? ` ${e.way.shut}` : ''}${on}`, { 'data-role': 'label', 'data-id': `note:${e.id}`, 'data-for': e.zoneId, 'data-placement': 'outside', ...(e.goto ? { 'data-goto': e.goto, tabindex: 0, role: 'button', 'aria-label': `${e.title}: open it` } : open) }, 'note'));
    }
    for (const st of sc.stairs) marks.append(s('g', { class: `map-stair${st.goto ? '' : ' unknown'}${st.zoneId === selected ? ' hot' : ''}`, 'data-role': 'icon', 'data-id': st.id, ...(st.goto ? { 'data-goto': st.goto, tabindex: 0, role: 'button' } : exitAttrs(st.zoneId, st.label)), 'aria-label': st.title },
      s('circle', { cx: st.cx, cy: st.cy, r: st.x1 - st.cx }), s('text', { x: st.cx, y: st.cy + 4, 'text-anchor': 'middle' }, st.up ? '▲' : '▼'), s('title', {}, st.title)));
    for (const f of sc.furniture) { const g = furnIcon(f.kind, cap(f.name), f.cx, f.cy); g.setAttribute('data-role', 'icon'); g.setAttribute('data-id', f.id); marks.append(g); }
    for (const t of sc.tokens) {
      if (t.you) { const g = pin(t.cx, t.cy, youAt?.title ?? 'You are here', facing); g.setAttribute('data-role', 'token'); g.setAttribute('data-id', 'you'); marks.append(g); continue; }
      const who = t.who!;
      const foot = footprintMark(t.cx, t.cy, t.r, who, PX_PER_M * k);
      // BG-324: the disc alone is the token the checker measures; the initial's text box is taller than the disc, its letter is not
      marks.append(s('g', { class: `map-who plan-who${who.now ? '' : ' last'}${who.at ? ' at' : ''}`, 'data-zone': t.zoneId, 'data-who': who.id }, ...(foot ? [foot] : []),
        s('g', {}, s('circle', { cx: t.cx, cy: t.cy, r: t.r, 'data-role': 'token', 'data-id': t.id }), s('text', { x: t.cx, y: t.cy + 3, 'text-anchor': 'middle' }, whoInitial(who.name))),
        s('text', { x: t.cx + t.r + 4, y: t.cy + 4, class: 'map-who-label' }, who.name), s('title', {}, t.title)));
    }
    const bar = barOf(sc, k);
    const scale = s('g', { class: 'map-scale' }, s('line', { x1: bar.x, y1: bar.y, x2: bar.x + bar.len, y2: bar.y }), s('line', { x1: bar.x, y1: bar.y - 5, x2: bar.x, y2: bar.y + 5 }),
      s('line', { x1: bar.x + bar.len, y1: bar.y - 5, x2: bar.x + bar.len, y2: bar.y + 5 }), s('text', { x: bar.x + bar.len + 8, y: bar.y + 4 }, `${distText(10)} · ${Math.round(10 / CONFIG.PACE_M)} paces`));
    planLayer.replaceChildren(fog, ...areas, zoneG, names, marks, scale);
    drawLegend();
    scheduleCheck();
  }
  /** a zone to scale: its floor at its real size, each side drawn as its edge kind; a zone only seen, never stood in, is
   *  hatched (MAP-33, MAP-34: the state reads without colour) */
  function planZone(z: MapZone, b: { x0: number; y0: number; x1: number; y1: number }, state: string) {
    const cls = ['map-tile', 'plan', z.outdoor ? 'outdoor' : 'indoor', z.inView ? 'in-view' : 'remembered', state, z.here ? 'here' : '', z.id === walk?.toZone ? 'heading' : '', z.id === selected ? 'selected' : '', z.light === 'dark' ? 'dark' : ''].filter(Boolean).join(' ');
    const m2 = Math.round(z.outline?.length ? areaOf(z.outline) : z.rect!.w * z.rect!.d);
    const said = state === 'current' ? 'you are here' : state === 'explored' ? 'you have been here' : 'seen, not been in';
    const w = b.x1 - b.x0, hh = b.y1 - b.y0;
    // the drawn floor sits a hair inside its walls, so zones that share a wall never measure as overlapping (MAP-11)
    const fm = floorMarks(z, z.rect!.w ? w / z.rect!.w : PX_PER_M, 0, 0), tag = { 'data-role': 'zone', 'data-id': z.id, 'data-parent': z.placeId };
    const g = s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}, ${m2} m², ${said}${z.id === walk?.toZone ? ', you are heading here' : ''}` },
      fm.floor ? s('polygon', { points: fm.floor, class: 'map-tile-box', ...tag }) : s('rect', { x: b.x0 + 0.5, y: b.y0 + 0.5, width: Math.max(0, w - 1), height: Math.max(0, hh - 1), class: 'map-tile-box', ...tag }));
    if (state === 'seen') g.append(fm.floor ? s('polygon', { points: fm.floor, class: 'map-tile-hatch' }) : s('rect', { x: b.x0 + 0.5, y: b.y0 + 0.5, width: Math.max(0, w - 1), height: Math.max(0, hh - 1), class: 'map-tile-hatch' }));
    g.append(...fm.walls);
    g.append(s('title', {}, `${z.name}: ${Math.round(z.rect!.w)} × ${Math.round(z.rect!.d)} m (${m2} m²), ${said}`));
    return g;
  }
  /** a doorway where it stands on the floor plan (BG-313): a door's leaf, a gap with no door, or its barrier's mark (locked,
   *  barred, blocked: MAP-33 shows locked on the door, not the zone) */
  function doorMark(d: Scene['doors'][number]) {
    const r = d.x1 - d.cx, attrs = { 'data-role': 'icon', 'data-id': d.id, role: 'img', 'aria-label': d.title };
    if (d.way?.shut) return s('g', { class: `map-way ${d.way.shut}${d.way.key ? ' key' : ''}`, ...attrs }, s('circle', { cx: d.cx, cy: d.cy, r }), ...wayGlyph(d.cx, d.cy, d.way.shut), s('title', {}, d.title));
    return s('g', { class: `map-door ${d.kind}`, ...attrs }, ...doorGlyph(d.cx, d.cy, d.kind, d.dir), s('title', {}, d.title));
  }
  /** the key (MAP-30): every mark the map shows now, and nothing it doesn't */
  const legendSlot = h('section', { class: 'map-legend' });
  function drawLegend() {
    const u = scene?.used ?? new Set<string>();
    const sw = (cls: string) => h('i', { class: `k-tile ${cls}` });
    const item = (key: string, mark: Node, text: string) => (u.has(key) ? [h('li', {}, mark, text)] : []);
    const svgKey = (...kids: SVGElement[]) => s('svg', { class: 'k-svg', width: 20, height: 20, viewBox: '-10 -10 20 20', 'aria-hidden': 'true' }, ...kids);
    const edge = (id: string, cls: string, text: string) => item(`edge:${id}`, h('i', { class: `k-edge ${cls}` }), text);
    legendSlot.replaceChildren(h('p', { class: 'hs-label' }, 'Key'), h('ul', {},
      ...item('state:explored', sw('explored'), 'Been there'), ...item('state:seen', sw('seen'), 'Seen, not been in'),
      ...item('remembered', sw('faded'), 'Out of sight now'),
      ...item('outdoor', sw('outdoor'), 'Outdoors'), ...item('indoor', sw('indoor'), 'Indoors'),
      ...edge('wall', 'wall', 'Wall'), ...edge('low', 'low', 'Counter, low wall or fence'), ...edge('window', 'window', 'Wall of windows'), ...edge('open', 'open', 'Open side'),
      ...item('place', h('i', { class: 'k-area' }), 'A building or place inside this one'),
      ...item('door', svgKey(s('line', { x1: -10, y1: 0, x2: 10, y2: 0, class: 'map-edge wall' }), s('g', { class: 'map-door door' }, ...doorGlyph(0, 0, 'door'))), 'Door in a wall'),
      ...item('opening', svgKey(s('g', { class: 'map-door opening' }, ...doorGlyph(0, 0, 'opening'))), 'Way through, no door'),
      ...item('way:locked', wayKey('locked'), 'Locked'), ...item('way:locked-key', wayKey('locked key'), 'Locked, you hold its key'),
      ...item('way:barred', wayKey('barred'), 'Barred'), ...item('way:blocked', wayKey('blocked'), 'Blocked'),
      ...item('exit', h('i', { class: 'k-line stub' }), 'Exit you have not taken, and where it goes'), ...item('exit-away', h('i', { class: 'k-line away' }), 'Way to another map: click to open it'),
      ...item('stairs-up', h('i', { class: 'k-stair' }, '▲'), 'Stairs up: click to change floor'), ...item('stairs-down', h('i', { class: 'k-stair' }, '▼'), 'Stairs down: click to change floor'),
      ...item('furniture', furnKey(), 'Furniture: point at one for its name'),
      ...item('who', h('i', { class: 'k-who' }), 'Someone there now: point for who'), ...item('who-last', h('i', { class: 'k-who last' }), 'Last seen there')));
  }
  // MAP-51: in dev views (?fake= or ?mapcheck) the checker runs on every to-scale render, once the browser has laid it out
  const devCheck = typeof location !== 'undefined' && /[?&](fake|mapcheck)\b/.test(location.search);
  let checkTimer = 0;
  function scheduleCheck() {
    if (!devCheck) return;
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => requestAnimationFrame(() => {
      if (!planMap() || !cur) return;
      const ids = worldZones().map((z) => z.id), have = new Set(ids);
      const pairs = worldZones().flatMap((z) => z.links.filter((l) => have.has(l.to)).map((l) => [z.id, l.to] as [string, string]));
      const start = have.has(cur.zoneId) ? cur.zoneId : ids[0];
      const findings = [...checkMap(svg), ...checkReach(ids, pairs, start), ...checkStage(floorZones(), innerPlaces(floorZones())), ...(scene?.lost ?? []).map((id) => `MAP-32 exit ${id} found no room for its arrow and note`)];
      if (scene?.dropped.length) console.info('[map-check] marks hidden in place for room at this zoom (listed in the zone card):', scene.dropped.join(', '));
      (window as unknown as { __mapFindings?: unknown }).__mapFindings = { place: placeOf(world)?.name, floor: floor(), k: view().k, findings };
      if (findings.length) for (const f of findings) console.warn('[map-check]', f);
      else console.info('[map-check] 0 findings');
    }), 120);
  }
  /** To scale: a 10 m bar under the plan, with the same length in paces */
  function scaleBar(zs: MapZone[], sp: Map<string, Pt>) {
    let x0 = Infinity, y1 = -Infinity;
    for (const z of zs) { const c = sp.get(z.id)!; x0 = Math.min(x0, c.x - tw(z) / 2); y1 = Math.max(y1, c.y + th(z) / 2); }
    // the bar's length suits the map: 10 m for a place, and in the World a tenth of its width rounded to 10 m, 100 m or 1 km
    const span = Math.max(...zs.map((z) => (z.rect?.w ?? 0))), m = world === WORLD ? [1000, 100, 10].find((x) => x <= span / 5) ?? 10 : 10;
    const len = m * PX_PER_M, y = y1 + 28;
    return s('g', { class: 'map-scale' }, s('line', { x1: x0, y1: y, x2: x0 + len, y2: y }), s('line', { x1: x0, y1: y - 5, x2: x0, y2: y + 5 }), s('line', { x1: x0 + len, y1: y - 5, x2: x0 + len, y2: y + 5 }),
      s('text', { x: x0 + len + 8, y: y + 4 }, `${distText(m)} · ${Math.round(m / CONFIG.PACE_M)} paces`));
  }
  function pill(x: number, y: number, text: string, tone = '', lean = 0) {
    const w = text.length * 6.6 + 18;
    const x0 = lean > 0.3 ? x : lean < -0.3 ? x - w : x - w / 2;
    return s('g', { class: `map-pill ${tone}` }, s('rect', { x: x0, y: y - 11, width: w, height: 22, rx: 11 }), s('text', { x: x0 + w / 2, y: y + 4, 'text-anchor': 'middle' }, text));
  }
  /** CO9, World to scale: a place as its real extent; its name goes on the fixed-size name layer */
  function worldPlanTile(z: MapZone, p: Pt, sub: string) {
    const w = tw(z), hh = th(z), x = p.x - w / 2, y = p.y - hh / 2;
    const road = placeOf(z.id)?.kind === 'road';
    const cls = ['map-tile', 'world-place', 'plan', road ? 'road' : '', z.inView ? 'in-view' : 'remembered', z.here ? 'here' : '', z.id === selected ? 'selected' : ''].filter(Boolean).join(' ');
    // WZ1: a road bound to the land runs along its road line; its name sits over the line's middle
    const lineLen = z.line ? lineLength(z.line) : 0;
    const mid = z.line ? pointAlong(z.line, lineLen / 2) : null;
    const alt = z.line ? [0.5, 0.3, 0.7, 0.15, 0.85].map((t) => {
      const q = pointAlong(z.line!, lineLen * t), a = pointAlong(z.line!, lineLen * t - 50), b = pointAlong(z.line!, lineLen * t + 50);
      return { x: q.x * PX_PER_M, y: -q.y * PX_PER_M, steep: Math.abs(b.y - a.y) > Math.abs(b.x - a.x) };
    }) : undefined;
    // MAP-71: a settlement's size from the land's site it stands on, else from its place kind when that names a size
    const kind = placeOf(z.id)?.kind, size = cur?.land?.flatMap((l) => l.region.sites).find((x) => x.placeId && rootOf(x.placeId) === z.id)?.size
      ?? SITE_SIZES.find((x) => x === kind), a = size ? `, a ${size}` : '';
    worldNames.push(road ? { x: mid ? mid.x * PX_PER_M : p.x, y: mid ? -mid.y * PX_PER_M : y, name: z.name, sub: z.line ? distText(lineLen) : z.rect ? distText(Math.max(z.rect.w, z.rect.d)) : sub, here: z.here, mid: true, ...(alt ? { alt } : {}) } : { x, y, y1: y + hh, name: z.name, sub, here: z.here, ...(size ? { icon: size } : {}) });
    if (road) {
      // RD2: a road is one line along its length, with a wider invisible line under it so it is easy to click
      const ew = z.rect!.w >= z.rect!.d, len = distText(z.line ? lineLen : Math.max(z.rect!.w, z.rect!.d));
      const ends = ew ? { x1: x, y1: p.y, x2: x + w, y2: p.y } : { x1: p.x, y1: y, x2: p.x, y2: y + hh };
      const way = (cls2: string) => z.line ? s('polyline', { points: z.line.map((q) => `${q.x * PX_PER_M},${-q.y * PX_PER_M}`).join(' '), class: cls2, 'vector-effect': 'non-scaling-stroke' })
        : s('line', { ...ends, class: cls2, 'vector-effect': 'non-scaling-stroke' });
      return s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}, a road about ${len} long` },
        way('map-road-hit'), way('map-tile-box'), s('title', {}, `${z.name}: a road about ${len} long · click for where it goes`));
    }
    return s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}${a}, ${sub}, about ${distText(z.rect!.w)} by ${distText(z.rect!.d)}` },
      s('rect', { x, y, width: w, height: hh, class: 'map-tile-box', 'vector-effect': 'non-scaling-stroke' }), s('title', {}, `${z.name}${a}: about ${distText(z.rect!.w)} × ${distText(z.rect!.d)}`));
  }


  function drawCrumbs() {
    const chain: MapPlace[] = [];
    if (world !== WORLD) for (let q = placeOf(focus); q && chain.length < 20; q = q.parentId ? placeOf(q.parentId) : undefined) chain.unshift(q);
    crumbs.replaceChildren(h('button', { type: 'button', class: 'crumb' + (world === WORLD ? ' on' : ''), title: 'Every place you know', onclick: () => showWorld() }, 'World'),
      ...chain.flatMap((q) => [h('span', { class: 'sep', 'aria-hidden': 'true' }, '›'),
        h('button', { type: 'button', class: 'crumb' + (q.id === focus ? ' on' : ''), onclick: () => show(q.id) }, q.name)]));
  }

  function drawSide() {
    const z = worldZones().find((x) => x.id === selected);
    const all = cur!.places.flatMap((p) => p.zones);
    const zoneName = (id: string) => all.find((x) => x.id === id)?.name;
    const climb = (from: MapZone, to: string) => { const t = all.find((x) => x.id === to); const d = t ? t.height - from.height : 0; return d ? `, ${Math.abs(d)} m ${d > 0 ? 'up' : 'down'}` : ''; };
    const pl = placeOf(focus)!;
    const worldCard = () => {
      // a road that is a place of its own (kind road) is one road between the places at its ends; other places joined
      // straight to each other list each link once
      const isRoad = (id: string) => placeOf(id)?.kind === 'road';
      const roads = [
        ...tilesOfWorld.filter((a) => isRoad(a.id)).map((a) => ({ label: a.name, a: ((n) => (n.length === 2 ? n.join(' ↔ ') : n.join(', ')))(roadEnds(a).map((l) => placeOf(l.to)?.name ?? l.to)) || 'nowhere known', b: a.name, to: a.id })),
        ...tilesOfWorld.filter((a) => !isRoad(a.id)).flatMap((a) => a.links.filter((l) => !isRoad(l.to) && (a.id < l.to || !tilesOfWorld.find((b) => b.id === l.to)?.links.some((m) => m.to === a.id))))
          .map((l) => ({ label: l.label, a: placeOf(tilesOfWorld.find((t) => t.links.includes(l))!.id)?.name ?? '', b: placeOf(l.to)?.name ?? l.to, to: l.to })),
      ];
      return h('section', { class: 'map-card' },
        h('div', { class: 'map-card-h' }, h('h2', {}, 'The world'), h('span', { class: 'hs-tg' }, `${tilesOfWorld.length} place${tilesOfWorld.length === 1 ? '' : 's'}`)),
        h('p', { class: 'hs-note' }, 'Every place you know and the roads you know between them. Click a place to open its map, or a road to see where it goes.'),
        h('p', { class: 'hs-label' }, 'Roads'),
        roads.length ? h('ul', { class: 'map-exits' }, roads.map((r) => h('li', {}, h('span', {}, r.label), h('span', { class: 'to' }, isRoad(r.to) ? r.a : `${r.a} ↔ ${r.b}`),
          h('button', { type: 'button', class: 'map-go', title: `Open ${r.b}`, 'aria-label': `Open ${r.b}`, onclick: () => show(r.to) }, '›'))))
          : h('p', { class: 'hs-note' }, 'No roads between places yet. Leave this place by a road to find the next one.'));
    };
    // RD2: a road's card: how long it is, where you are on it, where it goes and the places along it
    const roadCard = (id: string) => {
      const t = tilesOfWorld.find((x) => x.id === id);
      if (!t) return worldCard();
      const zs = placeOf(id)?.zones ?? [], hz = zs.find((x) => x.here);
      const people = zs.flatMap((x) => x.people), items = zs.flatMap((x) => x.items);
      const ends = roadEnds(t), along = t.links.filter((l) => placeOf(l.to)?.parentId === id);
      const row = (l: MapLink) => h('li', {}, h('span', {}, placeOf(l.to)?.name ?? l.to), h('span', { class: 'to' }, l.label),
        h('button', { type: 'button', class: 'map-go', title: `Open ${placeOf(l.to)?.name ?? 'its map'}`, 'aria-label': `Open ${placeOf(l.to)?.name ?? 'its map'}`, onclick: () => show(l.to) }, '›'));
      return h('section', { class: 'map-card' },
        h('div', { class: 'map-card-h' }, h('h2', {}, t.name), h('span', { class: 'hs-tg' }, 'Road')),
        h('p', { class: 'hs-note' }, t.line ? `A road about ${distText(lineLength(t.line))} long` : t.rect ? `A road about ${distText(Math.max(t.rect.w, t.rect.d))} long` : 'A road'),
        hz?.along ? h('p', { class: 'map-heading', role: 'status' }, h('b', {}, 'You are here'), ` · ${distText(hz.along.m)} from its ${hz.along.from} end`) : '',
        zs[0]?.look ? h('p', { class: 'map-look' }, zs[0].look) : '',
        h('p', { class: 'hs-label' }, 'Where it goes'),
        ends.length ? h('ul', { class: 'map-exits' }, ends.map(row)) : h('p', { class: 'hs-note' }, 'You know neither end yet.'),
        along.length ? h('div', {}, h('p', { class: 'hs-label' }, 'Along it'), h('ul', { class: 'map-exits' }, along.map(row))) : '',
        people.length ? h('div', {}, h('p', { class: 'hs-label' }, 'People'), h('p', {}, ...people.map((p) => h('span', { class: 'hs-tg' + (p.now ? '' : ' faded') }, p.now ? p.name : `${p.name} (last seen)`)))) : '',
        items.length ? h('div', {}, h('p', { class: 'hs-label' }, 'On the ground'), h('p', {}, ...items.map((x) => h('span', { class: 'hs-tg' }, x)))) : '');
    };
    // an unexplored exit: where it leaves from, and Move to here, which types the order to take it
    const exitCard = (x: { zoneId: string; label: string }) => {
      const from = allZones().find((q) => q.id === x.zoneId);
      return h('section', { class: 'map-card' },
        h('div', { class: 'map-card-h' }, h('h2', {}, cap(x.label)), h('span', { class: 'hs-tg' }, 'Unexplored')),
        h('p', { class: 'hs-note' }, from ? `A way out of ${from.name} you have not taken yet` : 'A way you have not taken yet'),
        onMove ? h('button', { type: 'button', class: 'hs-btn-main map-move', 'data-move': x.label, title: 'Types the order in the action box for you to send', onclick: () => onMove(exitOrder(x.label)) }, 'Move to here') : '',
        h('p', { class: 'map-look' }, 'You don’t know what lies that way until you go.'),
        from ? h('button', { type: 'button', class: 'hs-btn-text', onclick: () => { exitSel = null; draw(); } }, `Back to ${from.name}`) : '');
    };
    // the zone's place under its name, unless it only says the name again (a one-zone place: "tavern", "tavern")
    const placeLine = (z: MapZone) => { const n = placeOf(z.placeId)?.name ?? ''; return n && n.toLowerCase() !== z.name.toLowerCase() ? h('p', { class: 'hs-note' }, n) : ''; };
    // SD8: only what is unusual about a zone in view: indoors, light short of bright, any cover; nothing for the plain case
    const unusualLine = (z: MapZone) => {
      const bits = [z.outdoor ? '' : 'Indoors', z.light && z.light !== 'bright' ? `${z.light} light` : '', z.cover && z.cover !== 'none' ? `${z.cover} cover` : ''].filter(Boolean);
      return bits.length ? h('p', { class: 'hs-note' }, cap(bits.join(' · '))) : '';
    };
    const card = world === WORLD ? (isRoad(selected) ? roadCard(selected) : worldCard()) : exitSel ? exitCard(exitSel) : z ? h('section', { class: 'map-card' },
      // SD8: where you are is the gold outline and your token, said once; the place's name only when it differs from the zone's
      h('div', { class: 'map-card-h' }, h('h2', {}, z.name), z.here ? '' : h('span', { class: 'hs-tg' }, z.inView ? 'In view' : 'Remembered')),
      placeLine(z),
      z.id === walk?.toZone ? h('p', { class: 'map-heading', role: 'status' }, h('b', {}, 'Heading here'), ` · ${walkLeft(walk)}`) : '',
      !z.here && onMove ? h('button', { type: 'button', class: 'hs-btn-main map-move', 'data-move': z.id, title: 'Types the order in the action box for you to send', onclick: () => onMove(moveHere(z)) }, 'Move to here') : '',
      z.look ? h('p', { class: 'map-look' }, z.look) : '',
      z.inView ? unusualLine(z) : h('p', { class: 'hs-note' }, 'Out of sight now, so light, people and things on the ground may have changed.'),
      z.links.length ? h('p', { class: 'hs-label' }, 'Exits') : '',
      z.links.length ? h('ul', { class: 'map-exits' }, z.links.map((l) => h('li', {},
        h('span', {}, l.label),
        h('span', { class: 'to' }, l.known ? `to ${zoneName(l.to) ?? 'a known zone'}${l.otherPlace ? ` (${l.otherPlace})` : ''}${climb(z, l.to)}` : 'unexplored',
          l.way ? h('span', { class: `map-exit-way${l.way.shut ? ` ${l.way.shut}` : ''}${l.way.key ? ' key' : ''}` }, ` · ${wayWords(l.way)}`) : ''),
        l.known ? h('button', { type: 'button', class: 'map-go', title: 'Show this zone', 'aria-label': `Show ${zoneName(l.to) ?? 'this zone'}`, onclick: () => goTo(l.to) }, '›') : ''))) : '',
      z.people.length ? h('div', {}, h('p', { class: 'hs-label' }, 'People'), h('p', {}, ...z.people.map((p) => h('span', { class: 'hs-tg' + (p.now ? '' : ' faded') }, p.now ? p.name : `${p.name} (last seen)`)))) : '',
      z.furniture?.length ? h('div', {}, h('p', { class: 'hs-label' }, 'Furniture'), h('p', {}, ...z.furniture.map((f) => h('span', { class: 'hs-tg' }, cap(f.name))))) : '',
      z.items.length ? h('div', {}, h('p', { class: 'hs-label' }, 'On the ground'), h('p', {}, ...z.items.map((x) => h('span', { class: 'hs-tg' }, x)))) : '')
      : h('section', { class: 'map-card' }, h('p', { class: 'hs-note' }, 'Click a zone on the map to see what you know about it.'));
    const count = (p: MapPlace) => cur!.places.filter((q) => inside(q.id, p.id)).reduce((n, q) => n + q.zones.length, 0);
    const placeList = h('section', { class: 'map-places' }, h('p', { class: 'hs-label' }, 'Places you know'),
      h('ul', {}, cur!.places.map((p) => h('li', { style: `--d:${p.depth}` }, h('button', { type: 'button', class: 'map-place' + (p.id === focus && world !== WORLD ? ' on' : ''), onclick: () => show(p.id), 'aria-current': p.id === focus ? 'true' : undefined },
        h('span', { class: 'n' }, p.name),
        h('span', { class: 'c' }, count(p) ? `${count(p)} zone${count(p) === 1 ? '' : 's'}` : 'no zones known'))))));
    const facts = pl?.facts.length ? h('section', {}, h('p', { class: 'hs-label' }, `What you know about ${pl.name}`), h('ul', { class: 'map-facts' }, pl.facts.map((f) => h('li', {}, f)))) : '';
    // the World's key: places, roads, and the land once some is made out
    const legend = h('section', { class: 'map-legend' }, h('p', { class: 'hs-label' }, 'Key'),
      h('ul', {},
        h('li', {}, h('i', { class: 'k-area' }), 'A place you know: click to open its map'), h('li', {}, h('i', { class: 'k-line away' }), 'Road: click for where it goes'),
        // WZ4: the land once you have made some out
        ...(cur?.land?.length ? [h('li', {}, h('i', { class: 'k-land' }), 'Land you have seen: fields, woods…'), h('li', {}, h('i', { class: 'k-land-water' }), 'River or stream'),
          h('li', {}, h('i', { class: 'k-land-road' }), 'Road or track on the land'), ...(['town', 'village', 'hamlet'] as const).map((n) => h('li', {}, kSite(n), cap(n))),
          h('li', {}, kSite('village', ' faint'), 'Known by word, not seen'), h('li', {}, h('i', { class: 'k-mark' }), 'Landmark')] : [])));
    side.replaceChildren(card, planMap() ? legendSlot : legend, facts, placeList);
  }

  /** the places a road runs between: the ones it joins that are not along it (a waystation inside the road place) */
  function roadEnds(t: MapZone) { return t.links.filter((l) => placeOf(l.to)?.parentId !== t.id); }
  function goTo(zoneId: string) {
    const z = cur!.places.flatMap((p) => p.zones).find((x) => x.id === zoneId);
    if (!z) return;
    const w = rootOf(z.placeId);
    if (isRoad(w)) { showRoad(w); return; } // RD3: a road arrow opens the World on that road
    selected = zoneId; focus = z.placeId;
    floors.set(w, z.height);
    if (w !== world) { world = w; draw(); requestAnimationFrame(() => fit(w)); } else { draw(); centre(zoneId); }
  }
  function setFloorOf(zoneId: string) { const z = allZones().find((x) => x.id === zoneId); if (z) floors.set(rootOf(z.placeId), z.height); }
  /** the height slider: one stop per height this map has, lowest at the bottom; hidden when it has one */
  function drawFloors() {
    const hs = mapHeights(world === WORLD ? [] : worldZones());
    floorBar.hidden = hs.length < 2;
    if (hs.length < 2) { floorBar.replaceChildren(); return; }
    const mineH = cur ? worldZones().find((z) => z.id === cur!.zoneId)?.height : undefined;
    const at = Math.max(0, hs.indexOf(floor()));
    const said = (x: number) => `${floorName(x)}${x === mineH ? ' · you' : ''}`;
    const out = h('output', { class: 'map-floor-now' }, floorName(hs[at]), hs[at] === mineH ? h('span', { class: 'you' }, ' · you') : '');
    const range = h('input', { type: 'range', class: 'map-floor-range', min: '0', max: String(hs.length - 1), step: '1', value: String(at), 'aria-label': 'Height shown',
      'aria-valuetext': said(hs[at]), oninput: (e: Event) => { floors.set(world, hs[+(e.target as HTMLInputElement).value]); draw(); } }) as HTMLInputElement;
    floorBar.replaceChildren(h('span', { class: 'hs-label' }, 'Height'),
      h('div', { class: 'map-floor-track' }, range, h('div', { class: 'map-floor-stops', 'aria-hidden': 'true' }, ...hs.map((x, i) => h('span', { class: i === at ? 'on' : '' }, floorName(x))).reverse())), out);
  }
  function showWorld() {
    world = WORLD; selected = ''; draw();
    requestAnimationFrame(() => fit(WORLD));
  }
  /** RD1, RD3: the World zoomed to a road, with its card */
  function showRoad(id: string) {
    world = WORLD; selected = focus = id; draw();
    requestAnimationFrame(() => fit(id));
  }
  function show(id: string) {
    if (isRoad(id)) { showRoad(id); return; }
    const w = rootOf(id);
    focus = id;
    const here = worldZones().find((z) => z.here && inside(z.placeId, id));
    selected = here?.id ?? (selected && inside(worldZones().find((z) => z.id === selected)?.placeId ?? '', id) ? selected : '');
    world = w;
    // the floor: yours when you are in this place, else its ground (or the height with most of its zones)
    const mine = worldZones().find((z) => z.here && inside(z.placeId, id));
    const zs = worldZones().filter((z) => inside(z.placeId, id));
    if (mine) floors.set(w, mine.height);
    else if (zs.length && !zs.some((z) => z.height === floor())) floors.set(w, zs.some((z) => z.height === 0) ? 0 : mode(zs.map((z) => z.height)));
    draw();
    requestAnimationFrame(() => fit(id));
  }

  function draw() {
    if (!cur) return;
    youAt = null; // set again when a to-scale tile draws you at your own point
    worldNames = []; landNames = []; landG = null; // set again when the World draws to scale
    nameLayer.replaceChildren();
    tilesOfWorld = worldTiles(cur);
    if (world !== WORLD && !placeOf(world)) world = mapOf(cur.placeId);
    if (!placeOf(focus)) focus = cur.placeId;
    if (world !== WORLD && !placeOf(world)) { empty.hidden = false; empty.textContent = 'You know no places yet.'; vp.replaceChildren(bg); return; }
    drawCrumbs();
    drawSide();
    if (!worldZones().length) { vp.replaceChildren(bg); empty.hidden = false; empty.textContent = world === WORLD ? 'You know no places yet.' : `You know of ${placeOf(world)!.name}, but none of its zones yet.`; return; }
    empty.hidden = true;
    drawMap();
    apply();
  }

  function update() {
    const st = api.state();
    if (!st) { el.replaceChildren(h('h1', {}, 'Map'), h('p', { class: 'empty' }, 'No story yet. Create your character first.')); cur = null; return; }
    cur = knownMap(st);
    facing = st.player.facing;
    try { walk = st.player.walking ? buildPlayerView(st).player.walking : undefined; } catch { walk = undefined; }
    if (!el.contains(stage)) el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Map'))),
      h('div', { class: 'map-body' }, stage, side));
    const moved = cur.zoneId !== lastHere, was = world;
    if (moved) {
      lastHere = cur.zoneId; world = mapOf(cur.placeId); focus = cur.placeId; setFloorOf(cur.zoneId);
      selected = world === WORLD ? rootOf(cur.placeId) : cur.zoneId; // RD1: on a road, its card
    }
    const fresh = !views.has(world) || world !== was; // a new map (onto a road, into a town) opens fitted
    draw();
    if (fresh) requestAnimationFrame(() => fit(planMap() ? world : focus)); // to scale, the whole map first: nothing past its edge (MAP-50)
    else if (moved) requestAnimationFrame(() => centre(cur!.zoneId));
  }
  return { el, update };
}
