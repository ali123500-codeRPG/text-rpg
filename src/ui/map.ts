// Map page: the zones your character knows, drawn as a map of the place you pick. Zones are tiles joined by their
// exits (solid: you can see across; dashed: a door or a turn hides the far side); exits you never took end in an
// "unexplored" stub. Tiles are laid out by a small force layout that leans on compass words in exit names, and keep
// their spots between turns. Drag to pan, wheel or the buttons to zoom. Clicking a zone shows it in the side column.
import type { GameApi, WalkingView } from '../types';
import { h } from './kit';
import { verticalOf } from '../scenario/heights';
import { EK } from '../library/tableIds';
import { furnIcon, furnKey } from './furnitureIcons';
import { CONFIG } from '../config';
import { buildPlayerView, distText } from '../views';
import { walkLeft } from './doing';
import { landLayer, landLabels, type LandLabel } from './landSvg';
import { lineLength } from '../land/generate';
import { worldTiles, compassOf, knownMap, pointAlong, type KnownMap, type MapLink, type MapPlace, type MapWay, type MapZone } from './mapData';
import { cap } from '../words';
import { MAX_K, PX_PER_M, TEXT, checkReach, checkStage, planScene, roughMeasure, type Measure, type Scene } from './mapPlan';
import { checkMap } from './mapCheck';

/** CSS class of each edge kind's line on the To scale view */
const EDGE_CLASS: Record<string, string> = { [EK.wall]: 'wall', [EK.open]: 'open', [EK.low]: 'low', [EK.window]: 'window' };

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag: string, attrs: Record<string, string | number> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};

const TILE_H = 58, TILE_H_PEOPLE = 84, LINK_LEN = 300, STUB = 90;
/** below this stage width, fitting a place never shrinks tiles past NARROW_MIN_K */
const NARROW_W = 640, NARROW_MIN_K = 0.75;
/** the most people dots a tile shows; the rest are a "+n" */
const MAX_DOTS = 6;
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
type Node2 = Pt & { id: string; w: number; h: number; vx: number; vy: number; pinned: boolean };
const tileW = (z: MapZone) => Math.max(132, Math.min(260, z.name.length * 8.4 + 40));
const tileH = (z: MapZone) => (z.people.length || z.along ? TILE_H_PEOPLE : TILE_H);

/** a barrier on an exit in words: "door, locked", "gate, locked: you hold its key", "door, standing open" */
export function wayWords(w: MapWay): string {
  return w.shut === 'locked' && w.key ? `${w.kind}, locked: you hold its key` : w.shut ? `${w.kind}, ${w.shut}` : w.open ? `${w.kind}, standing open` : w.kind;
}
/** the marks drawn inside a barrier badge centred on x, y */
function wayGlyph(x: number, y: number, shut: NonNullable<MapWay['shut']>): SVGElement[] {
  return shut === 'locked' ? [s('rect', { x: x - 4.5, y: y - 1, width: 9, height: 7, rx: 1.5 }), s('path', { d: `M${x - 2.75} ${y - 1}v-2.5a2.75 2.75 0 0 1 5.5 0v2.5`, fill: 'none' })]
    : shut === 'barred' ? [s('rect', { x: x - 4, y: y - 5.5, width: 8, height: 11, rx: 1, fill: 'none' }), s('line', { x1: x - 6.5, y1: y, x2: x + 6.5, y2: y })]
    : [s('line', { x1: x - 4, y1: y - 4, x2: x + 4, y2: y + 4 }), s('line', { x1: x + 4, y1: y - 4, x2: x - 4, y2: y + 4 })];
}
/** a door as a floor plan draws one: a 12 px gap across its wall, filled with a leaf (a door) or left open between two
 *  posts (a way through with no door); `dir` is the wall's run, h (east-west) or v */
function doorGlyph(x: number, y: number, kind: 'door' | 'opening', dir: 'h' | 'v' = 'h'): SVGElement[] {
  const [w, hh] = dir === 'h' ? [12, 6] : [6, 12];
  const gap = s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, class: 'gap' });
  if (kind === 'door') return [gap, s('rect', { x: x - w / 2 + (dir === 'h' ? 1.5 : 1.5), y: y - hh / 2 + 1.5, width: w - 3, height: hh - 3, rx: 0.5, class: 'leaf' })];
  return dir === 'h' ? [gap, s('line', { x1: x - 6, y1: y - 3, x2: x - 6, y2: y + 3 }), s('line', { x1: x + 6, y1: y - 3, x2: x + 6, y2: y + 3 })]
    : [gap, s('line', { x1: x - 3, y1: y - 6, x2: x + 3, y2: y - 6 }), s('line', { x1: x - 3, y1: y + 6, x2: x + 3, y2: y + 6 })];
}
/** a barrier badge for the map's key */
const wayKey = (cls: string) => s('svg', { class: `k-way map-way ${cls}`, width: 20, height: 20, viewBox: '-10 -10 20 20', 'aria-hidden': 'true' },
  s('circle', { cx: 0, cy: 0, r: 9 }), ...wayGlyph(0, 0, cls.split(' ')[0] as NonNullable<MapWay['shut']>));

/** deterministic force layout; zones laid out before keep their spots (they still settle a little) */
export function layout(zones: MapZone[], start: string, prev: Map<string, Pt>): Map<string, Pt> {
  const byPlace = new Map<string, string[]>(), place = new Map(zones.map((z) => [z.id, z.placeId]));
  // floors: zones at another height sit right above or below the zone their stairs reach, and never push each other
  const height = new Map(zones.map((z) => [z.id, z.height]));
  const level = (a: string, b: string) => height.get(a) === height.get(b);
  for (const z of zones) byPlace.set(z.placeId, [...(byPlace.get(z.placeId) ?? []), z.id]);
  const ids = new Set(zones.map((z) => z.id));
  const nodes = new Map<string, Node2>();
  const edges: { a: string; b: string; dir: [number, number] | null; stairs?: true }[] = [];
  for (const z of zones) for (const l of z.links) if (ids.has(l.to) && z.id < l.to || (ids.has(l.to) && !zones.find((q) => q.id === l.to)?.links.some((m) => m.to === z.id)))
    edges.push(!level(z.id, l.to) ? { a: z.id, b: l.to, dir: null, stairs: true } : { a: z.id, b: l.to, dir: compassOf(l.label) ?? (() => { const back = zones.find((q) => q.id === l.to)?.links.find((m) => m.to === z.id); const d = back ? compassOf(back.label) : null; return d ? [-d[0], -d[1]] as [number, number] : null; })() });
  // first spots: old ones kept; new zones placed breadth-first from where you are, each beside a placed neighbour,
  // on the side its exit's compass word names (else spread by the golden angle), so the forces start near the answer
  const spot = new Map<string, Pt>(prev);
  const taken = (p: Pt, id: string) => [...spot.entries()].some(([o, q]) => level(o, id) && Math.abs(q.x - p.x) < 150 && Math.abs(q.y - p.y) < 90);
  const order = [ids.has(start) ? start : zones[0].id];
  for (let i = 0; i < order.length; i++) for (const e of edges) { const o = e.a === order[i] ? e.b : e.b === order[i] ? e.a : null; if (o && !order.includes(o)) order.push(o); }
  for (const z of zones) if (!order.includes(z.id)) order.push(z.id);
  order.forEach((id, i) => {
    if (spot.has(id)) return;
    const e = edges.find((x) => (x.a === id && spot.has(x.b)) || (x.b === id && spot.has(x.a)));
    if (!e) { spot.set(id, spot.size ? { x: (i % 4) * LINK_LEN * 1.4, y: (Math.floor(i / 4) + 1) * LINK_LEN * 1.4 } : { x: 0, y: 0 }); return; }
    const from = spot.get(e.a === id ? e.b : e.a)!;
    if (e.stairs && !taken(from, id)) { spot.set(id, { ...from }); return; } // straight above or below
    const dir = e.dir ? (e.a === id ? [-e.dir[0], -e.dir[1]] : e.dir) : null;
    let p: Pt = { x: 0, y: 0 };
    for (let k = 0; k < 12; k++) {
      const ang = dir ? Math.atan2(dir[1], dir[0]) + (k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45 : 0) : i * 2.399963 + k * 0.7;
      p = { x: from.x + Math.cos(ang) * LINK_LEN, y: from.y + Math.sin(ang) * LINK_LEN };
      if (!taken(p, id)) break;
    }
    spot.set(id, p);
  });
  for (const z of zones) { const p = spot.get(z.id)!; nodes.set(z.id, { id: z.id, x: p.x, y: p.y, vx: 0, vy: 0, w: tileW(z), h: tileH(z), pinned: prev.has(z.id) }); }
  const list = [...nodes.values()];
  const steps = prev.size ? 160 : 420;
  for (let it = 0; it < steps; it++) {
    const cool = 1 - it / steps;
    for (const n of list) { n.vx = 0; n.vy = 0; }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!level(a.id, b.id)) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      if (!dx && !dy) { dx = 1; dy = 0.5; }
      const d = Math.hypot(dx, dy);
      const f = 52000 / (d * d) * (place.get(a.id) === place.get(b.id) ? 1 : 2.5); // different places push apart harder
      a.vx -= dx / d * f; a.vy -= dy / d * f; b.vx += dx / d * f; b.vy += dy / d * f;
      // tiles never overlap: push apart by the overlap of their boxes plus a margin
      const ox = (a.w + b.w) / 2 + 36 - Math.abs(dx), oy = (a.h + b.h) / 2 + 36 - Math.abs(dy);
      if (ox > 0 && oy > 0) { if (ox < oy) { const s2 = Math.sign(dx) * ox / 2; a.vx -= s2 * 4; b.vx += s2 * 4; } else { const s2 = Math.sign(dy) * oy / 2; a.vy -= s2 * 4; b.vy += s2 * 4; } }
    }
    for (const e of edges) {
      const a = nodes.get(e.a)!, b = nodes.get(e.b)!;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - (e.stairs ? 0 : LINK_LEN)) * 0.06;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
      if (e.dir) { // "north gate": b sits north of a
        const tx = a.x + e.dir[0] * LINK_LEN, ty = a.y + e.dir[1] * LINK_LEN;
        b.vx += (tx - b.x) * 0.05; b.vy += (ty - b.y) * 0.05; a.vx -= (tx - b.x) * 0.05; a.vy -= (ty - b.y) * 0.05;
      }
    }
    // a place's zones keep together, so each place reads as one area of the map
    for (const ids2 of byPlace.values()) {
      if (ids2.length < 2) continue;
      const c = ids2.reduce((acc, id) => ({ x: acc.x + nodes.get(id)!.x / ids2.length, y: acc.y + nodes.get(id)!.y / ids2.length }), { x: 0, y: 0 });
      for (const id of ids2) { const n = nodes.get(id)!; n.vx += (c.x - n.x) * 0.012; n.vy += (c.y - n.y) * 0.012; }
    }
    for (const n of list) {
      const k = (n.pinned ? 0.15 : 1) * Math.max(0.05, cool);
      n.x += Math.max(-40, Math.min(40, n.vx * k)); n.y += Math.max(-40, Math.min(40, n.vy * k));
    }
  }
  return new Map(list.map((n) => [n.id, { x: Math.round(n.x), y: Math.round(n.y) }]));
}

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
  const separated = new WeakSet<Map<string, Pt>>(); // layouts already pushed apart (separate)
  const views = new Map<string, { x: number; y: number; k: number }>(); // per world pan and zoom
  let cur: KnownMap | null = null, world = '';
  let walk: WalkingView | undefined; // AT49: the zone the player's walk is still headed for
  /** the key lists the barrier marks only once the map shows one */
  const anyShut = () => !!cur?.places.some((p) => p.zones.some((z) => z.links.some((l) => l.way?.shut)));
  /** FR5: the key shows the furniture mark once the plan draws some */
  const anyFurniture = () => planned() && !!cur?.places.some((p) => p.zones.some((z) => z.furniture?.length));
  const floors = new Map<string, number>(); // per world: the height shown
  // To scale (CO1, CO9): each zone, and in World each place, as its own rectangle at its real position in metres, so
  // neighbours touch along x and y; the default whenever code has placed every zone. ▦ switches to the exit diagram.
  let plan = true;
  const plannedLast = new Set<string>(); // worlds whose spots are the to-scale ones
  const planned = () => plan && worldZones().length > 0 && worldZones().every((z) => z.rect);
  /** a place's own map drawn to scale: the rpg-map stage map */
  const planMap = () => world !== WORLD && planned();
  const tw = (z: MapZone) => (planned() && z.rect ? z.rect.w * PX_PER_M : tileW(z));
  const th = (z: MapZone) => (planned() && z.rect ? z.rect.d * PX_PER_M : tileH(z));

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
  let worldNames: { x: number; y: number; y1?: number; name: string; sub: string; here: boolean; mid?: true; alt?: (Pt & { steep: boolean })[] }[] = [];
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
  svg.append(defs, vp, planLayer, nameLayer, youLayer);
  const stage = h('div', { class: 'map-stage' });
  const side = h('aside', { class: 'map-side', 'aria-label': 'Map details' });
  const crumbs = h('nav', { class: 'map-crumbs', 'aria-label': 'Place' });
  const compass = h('div', { class: 'map-compass', 'aria-hidden': 'true', title: 'North, from the exits’ compass words' }, 'N');
  const empty = h('p', { class: 'map-empty' });
  const zoomBtn = (label: string, title: string, f: () => void) => h('button', { type: 'button', class: 'map-btn', title, 'aria-label': title, onclick: f }, label);
  const tools = h('div', { class: 'map-tools' },
    zoomBtn('+', 'Zoom in', () => zoomBy(1.25)), zoomBtn('−', 'Zoom out', () => zoomBy(0.8)),
    zoomBtn('◎', 'Find me', () => findMe()), zoomBtn('⤢', 'Show the whole map', () => fit(world)));
  const planBtn = h('button', { type: 'button', class: 'map-btn map-plan-btn', title: 'Draw to scale (off: the exit diagram)', 'aria-label': 'Draw to scale', 'aria-pressed': 'true',
    onclick: () => { plan = !plan; planBtn.setAttribute('aria-pressed', String(plan)); draw(); requestAnimationFrame(() => fit(focus || world)); } }, '▦');
  tools.append(planBtn);
  const floorBar = h('nav', { class: 'map-floors', 'aria-label': 'Floor' });
  stage.append(svg, crumbs, compass, tools, floorBar, empty);

  const placeOf = (id: string) => cur?.places.find((p) => p.id === id);
  // RD2: a road is only a line on the World map, never a map of its own; a place along it (a waystation) is its own map
  const isRoad = (id: string) => placeOf(id)?.kind === 'road';
  const rootOf = (id: string) => { let p = placeOf(id); for (let n = 0; p?.parentId && placeOf(p.parentId) && !isRoad(p.parentId) && n < 20; n++) p = placeOf(p.parentId); return p?.id ?? id; };
  /** the map a place is drawn on: its top-level place's, or the World zoomed to the road when it is a road (RD1) */
  const mapOf = (id: string) => (isRoad(rootOf(id)) ? WORLD : rootOf(id));
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
    if (!(planned() && world === WORLD)) return 0.2;
    const b = bounds(WORLD), r = svg.getBoundingClientRect();
    return b && r.width ? Math.min(0.005, fitK(b, r) * 0.8) : 0.005;
  };
  /** to scale, the World's names run right from each place's north-west corner at a fixed size: room kept for them */
  const nameRoom = () => (planned() && world === WORLD ? 160 : 0);
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
      const tall = ((n.y1 ?? n.y) - n.y) * v.k, under = !n.mid && tall < 40, wd = Math.max(n.name.length * 8, n.sub.length * 7.5);
      // a road's name sits above a stretch that runs east-west, and beside one that runs north-south
      const spot = (n.alt ?? [{ ...n, steep: false }]).map((q) => {
        const x = v.x + q.x * v.k + (q.steep ? 14 : n.mid || under ? 0 : 8), y = v.y + q.y * v.k + (q.steep ? -4 : n.mid ? -34 : under ? tall + 18 : 18), c = n.mid && !q.steep;
        return { x, y, c, box: { x0: c ? x - wd / 2 : x, y0: y - 14, x1: c ? x + wd / 2 : x + wd, y1: y + 20 } };
      }).find((q) => !n.mid || !hits(q.box));
      if (!spot || spot.box.x1 < 0 || spot.box.y1 < 0 || spot.box.x0 > r.width || spot.box.y0 > r.height) return []; // off the map
      taken.push(spot.box);
      const { x, y } = spot, anchor: Record<string, string> = spot.c ? { 'text-anchor': 'middle' } : {};
      return [s('g', { class: `map-world-name${n.here ? ' here' : ''}${n.mid ? ' road' : ''}`, 'data-role': 'label', 'data-id': `world:${n.name}` },
        s('text', { x, y, class: 'map-tile-name', ...anchor }, n.name), s('text', { x, y: y + 16, class: 'map-tile-sub', ...anchor }, n.sub))];
    });
    nameLayer.replaceChildren(...names, ...landMarksAt(v, taken));
    youLayer.replaceChildren(...(youAt && !planMap() ? [pin(v.x + youAt.x * v.k, v.y + youAt.y * v.k, youAt.title)] : []));
    if (planMap()) {
      if (!scene || Math.abs(v.k - sceneK) > 1e-9) renderPlan(v.k);
      planLayer.setAttribute('transform', `translate(${v.x} ${v.y})`);
    } else { planLayer.replaceChildren(); scene = null; }
  };
  const setView = (v: { x: number; y: number; k: number }) => { views.set(world, v); apply(); };
  /** the land's settlements and landmarks on screen: a dot (a diamond for a landmark) with its name above; one that would
   *  cover a place's name, your pin or a bigger settlement's name, or lies off the map, is left out (MAP-23) */
  function landMarksAt(v: { x: number; y: number; k: number }, taken: { x0: number; y0: number; x1: number; y1: number }[]) {
    const r = svg.getBoundingClientRect(), R = { town: 5.5, village: 4.5, hamlet: 3.5, feature: 4 };
    const out: SVGElement[] = [];
    for (const l of landNames) {
      const x = v.x + l.at.x * PX_PER_M * v.k, y = v.y - l.at.y * PX_PER_M * v.k, w = l.name.length * 6.6, rr = R[l.kind];
      const box = { x0: Math.min(x - rr, x - w / 2), y0: y - rr - 18, x1: Math.max(x + rr, x + w / 2), y1: y + rr };
      if (box.x0 < 0 || box.y0 < 0 || box.x1 > r.width || box.y1 > r.height || taken.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
      taken.push(box);
      const said = `${l.name}${l.kind === 'feature' ? '' : `, a ${l.kind}`}${l.faint ? ': known by word, not seen' : ''}`;
      out.push(s('g', { class: `map-land-mark ${l.kind}${l.faint ? ' faint' : ''}`, 'data-role': 'label', 'data-id': `land:${l.id}`, role: 'img', 'aria-label': said },
        l.kind === 'feature' ? s('rect', { x: x - rr, y: y - rr, width: 2 * rr, height: 2 * rr, transform: `rotate(45 ${x} ${y})` }) : s('circle', { cx: x, cy: y, r: rr }),
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
    for (const z of zs) { const p = sp.get(z.id); if (!p) continue; const w = tw(z) / 2 + STUB, hh = th(z) / 2 + STUB; x0 = Math.min(x0, p.x - w); x1 = Math.max(x1, p.x + w); y0 = Math.min(y0, p.y - hh); y1 = Math.max(y1, p.y + hh); }
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
  /** an inner place's outline: its known zones' tiles plus a margin that grows for outer places, and a strip on top for its name */
  function areaBox(p: { depth: number }, zs: MapZone[], sp: Map<string, Pt>, maxDepth: number): Box | null {
    if (!zs.length) return null;
    const pad = planned() ? 0 : 30 + (maxDepth - p.depth) * 18;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const z of zs) { const c = sp.get(z.id); if (!c) continue; x0 = Math.min(x0, c.x - tw(z) / 2); x1 = Math.max(x1, c.x + tw(z) / 2); y0 = Math.min(y0, c.y - th(z) / 2); y1 = Math.max(y1, c.y + th(z) / 2); }
    return x0 === Infinity ? null : { x0: x0 - pad, y0: y0 - pad - (planned() ? 0 : 22), x1: x1 + pad, y1: y1 + pad };
  }
  /** the free layout knows zones, not places, so two places' outlines (or a place and a loose zone) can overlap. Push
   *  apart every pair of groups that overlap: each top place below the map's root with its zones, and each zone that
   *  sits in no inner place. The group holding the player stays put; the other moves the short way out, plus a gap. */
  function separate(sp: Map<string, Pt>, every: MapZone[]) {
    const GAP = 28;
    const inner = (cur?.places ?? []).filter((p) => rootOf(p.id) === world && p.id !== world);
    const maxDepth = Math.max(0, ...inner.map((p) => p.depth));
    const tops = inner.filter((p) => !p.parentId || p.parentId === world || !inner.some((q) => q.id === p.parentId));
    const groups = [
      ...tops.map((p) => ({ zs: every.filter((z) => inside(z.placeId, p.id)), box: () => areaBox(p, every.filter((z) => inside(z.placeId, p.id)), sp, maxDepth) })),
      ...every.filter((z) => !tops.some((p) => inside(z.placeId, p.id))).map((z) => ({ zs: [z], box: (): Box | null => { const c = sp.get(z.id); return c ? { x0: c.x - tw(z) / 2, y0: c.y - th(z) / 2, x1: c.x + tw(z) / 2, y1: c.y + th(z) / 2 } : null; } })),
    ].filter((g) => g.zs.length);
    const anchored = (g: { zs: MapZone[] }) => g.zs.some((z) => z.id === cur?.zoneId);
    for (let pass = 0; pass < 12; pass++) {
      let moved = false;
      for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i].box(), b = groups[j].box();
        if (!a || !b) continue;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + GAP, oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + GAP;
        if (ox <= 0 || oy <= 0) continue;
        const [still, ms] = anchored(groups[j]) ? [b, groups[i]] as const : [a, groups[j]] as const;
        const mBox = ms.box()!, sx = (mBox.x0 + mBox.x1) / 2 - (still.x0 + still.x1) / 2, sy = (mBox.y0 + mBox.y1) / 2 - (still.y0 + still.y1) / 2;
        const d = ox < oy ? { x: (sx < 0 ? -1 : 1) * ox, y: 0 } : { x: 0, y: (sy < 0 ? -1 : 1) * oy };
        for (const z of ms.zs) { const c = sp.get(z.id); if (c) sp.set(z.id, { x: c.x + d.x, y: c.y + d.y }); }
        moved = true;
      }
      if (!moved) break;
    }
  }

  function drawMap() {
    const every = worldZones(), zones = floorZones();
    const prev = spots.get(world) ?? new Map<string, Pt>();
    let sp = prev;
    if (planned()) { sp = new Map(every.map((z) => [z.id, { x: z.rect!.x * PX_PER_M, y: -z.rect!.y * PX_PER_M }])); spots.set(world, sp); }
    else if ([...prev.keys()].sort().join('|') !== every.map((z) => z.id).sort().join('|') || plannedLast.has(world)) { sp = layout(every, world === WORLD ? rootOf(cur!.placeId) : cur!.zoneId, plannedLast.has(world) ? new Map() : prev); spots.set(world, sp); }
    if (planned()) plannedLast.add(world); else plannedLast.delete(world);
    if (!planned() && world !== WORLD && !separated.has(sp)) { separate(sp, every); separated.add(sp); }
    if (planMap()) {
      // to scale, the layer above draws it all at the zoom shown (apply → renderPlan)
      vp.replaceChildren(bg); scene = null;
      drawFloors();
      compass.hidden = !zones.some((z) => z.links.some((l) => compassOf(l.label)));
      const here = zones.find((z) => z.here && z.you);
      youAt = here ? { x: here.you!.x * PX_PER_M, y: -here.you!.y * PX_PER_M, title: here.along ? alongText(here.along) : 'You are here' } : null;
      svg.setAttribute('aria-label', `Map of ${placeOf(world)?.name ?? 'this place'}: ${zones.length} zone${zones.length === 1 ? '' : 's'} known`);
      return;
    }
    // RD1: to scale, the World shows you at your own point, on a road or in a village
    const hz = hereZone();
    if (world === WORLD && planned() && hz?.you && hz.rect) {
      // on a road bound to the land, at your point along its line
      const at = hz.line && hz.along ? pointAlong(hz.line, hz.along.m) : hz.you;
      youAt = { x: at.x * PX_PER_M, y: -at.y * PX_PER_M, title: hz.along ? `You: ${alongText(hz.along)}` : 'You are here' };
    }
    landG = world === WORLD && planned() ? drawLand() : null; landPx = 0;
    const byId = new Map(zones.map((z) => [z.id, z]));
    const centroid = zones.reduce((a, z) => ({ x: a.x + sp.get(z.id)!.x / zones.length, y: a.y + sp.get(z.id)!.y / zones.length }), { x: 0, y: 0 });
    const areas = s('g', { class: 'map-areas' }), links = s('g', { class: 'map-links' }), tiles = s('g', { class: 'map-tiles' }), labels = s('g', { class: 'map-labels' });
    // areas: every inner place with known zones, outer places first so inner ones sit on top
    const inner = (cur?.places ?? []).filter((p) => rootOf(p.id) === world && p.id !== world).sort((a, b) => a.depth - b.depth);
    const maxDepth = Math.max(0, ...inner.map((p) => p.depth));
    for (const p of inner) {
      const zs = zones.filter((z) => inside(z.placeId, p.id));
      const b = areaBox(p, zs, sp, maxDepth);
      if (!b) continue;
      const on = p.id === focus, mine = inside(cur!.placeId, p.id);
      // to scale the outline is the place's real extent: square corners, its name on a tab above its north side
      const real = planned();
      areas.append(s('g', { class: `map-area${on ? ' on' : ''}${mine ? ' mine' : ''}${real ? ' real' : ''}`, 'data-area': p.id, tabindex: 0, role: 'button', 'aria-label': `${p.name}, ${zs.length} zones known` },
        s('rect', { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, rx: real ? 0 : 18 }),
        s('text', { x: b.x0 + (real ? 4 : 16), y: real ? b.y0 - 8 : b.y0 + 20, class: 'map-area-name' }, p.name)));
    }
    const done = new Set<string>();
    const stairs: { z: MapZone; l: MapZone['links'][number]; up: boolean; other?: MapZone }[] = [];
    let compassUsed = false;
    for (const z of zones) {
      const a = sp.get(z.id)!;
      z.links.forEach((l, i) => {
        if (compassOf(l.label)) compassUsed = true;
        const hot = z.id === selected || l.to === selected;
        const to = byId.get(l.to);
        if (to) { // both ends on this map
          const key = [z.id, l.to].sort().join('>');
          if (done.has(key)) return;
          done.add(key);
          if (planned() && world !== WORLD) return; // to scale, neighbouring zones touch: their shared wall is the exit
          const b = sp.get(l.to)!;
          const p1 = edgeOf(a, tw(z), th(z), b), p2 = edgeOf(b, tw(to), th(to), a);
          const road = world === WORLD;
          links.append(s('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: road ? 'map-link road' : `map-link${l.sight ? '' : ' hidden-view'}${hot ? ' hot' : ''}` },
            s('title', {}, road ? `${l.label}: ${z.name} ↔ ${to.name}` : `${l.label}: ${z.name} ↔ ${to.name}${l.sight ? ' · you can see across' : ' · the far side is out of sight'}`)));
          // a barrier you know stops you sits on the middle of its line; the exit's name then sits just above it
          const shut = [l, to.links.find((m) => m.to === z.id)].find((x) => x?.way?.shut);
          if (shut && !road) labels.append(wayMark((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, shut, z.name, to.name));
          const lab = z.id === selected ? l.label : to.links.find((m) => m.to === z.id)?.label ?? l.label;
          // the exit's name sits on the line only where the line is long enough to hold it; its tooltip always has it
          if ((hot || road) && Math.hypot(p2.x - p1.x, p2.y - p1.y) > Math.min(lab.length * 6.6 + 18, Math.abs(p2.y - p1.y) > Math.abs(p2.x - p1.x) ? 60 : lab.length * 6.6 + 40)) labels.append(pill((p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - (shut && !road ? 24 : 0), lab));
          return;
        }
        // stairs: a badge on the tile, never a line across the floor; a known far end opens its floor
        const other = every.find((x) => x.id === l.to);
        if ((other && other.height !== z.height) || (!l.known && verticalOf(l.label))) { stairs.push({ z, l, up: other ? other.height > z.height : verticalOf(l.label) > 0, other }); return; }
        // an exit to a zone you don't know: a short stub with an arrow
        let dx = a.x - centroid.x, dy = a.y - centroid.y;
        const dir = compassOf(l.label);
        if (dir) [dx, dy] = dir;
        if (!dx && !dy) { dx = Math.cos(i * 2.4); dy = Math.sin(i * 2.4); }
        const n = Math.hypot(dx, dy), ang = Math.atan2(dy / n, dx / n) + (dir ? 0 : (i % 3 - 1) * 0.35);
        const far = { x: a.x + Math.cos(ang) * (tw(z) / 2 + STUB), y: a.y + Math.sin(ang) * (th(z) / 2 + STUB) };
        const p1 = edgeOf(a, tw(z), th(z), far);
        // a known zone on another map (another village, say): the stub says where it goes and clicking it opens that map
        const away = l.known ? allZones().find((x) => x.id === l.to) : undefined;
        const awayName = away ? placeOf(rootOf(away.placeId))?.name ?? away.name : '';
        const text = away ? `${l.label} · to ${awayName}` : `${l.label} · unexplored`;
        links.append(s('line', { x1: p1.x, y1: p1.y, x2: far.x, y2: far.y, class: `map-stub${away ? ' away' : ''}${hot ? ' hot' : ''}`, 'marker-end': 'url(#map-arrow)', ...(away ? { 'data-goto': away.id } : exitAttrs(z.id, l.label)) },
          s('title', {}, away ? `${l.label}: to ${away.name} (${awayName}) · click to open that map` : `${l.label}: unexplored`)));
        if (l.way?.shut) labels.append(wayMark((p1.x + far.x) / 2, (p1.y + far.y) / 2, l, z.name, away?.name ?? ''));
        if (hot || away) {
          const pl = pill(far.x + Math.cos(ang) * 14, far.y + Math.sin(ang) * 14, text, away ? 'away' : 'unknown', Math.cos(ang));
          if (away) pl.setAttribute('data-goto', away.id); else for (const [k, v] of Object.entries(exitAttrs(z.id, l.label))) pl.setAttribute(k, String(v));
          labels.append(pl);
        }
      });
    }
    for (const z of zones) tiles.append(tile(z, sp.get(z.id)!, world === WORLD ? (z.here ? 'You are here' : z.look) : undefined));
    // to scale, people's discs go over every tile, so a neighbouring zone drawn later never hides one near its wall
    tiles.append(...Array.from(tiles.querySelectorAll('.plan-who')));
    // stair badges at the tile's left edge: up at the top corner, down at the bottom, side by side when there are several
    const nth = new Map<string, number>();
    for (const st of stairs) {
      const c = sp.get(st.z.id)!, w = tw(st.z), hh = th(st.z), key = `${st.z.id}${st.up}`, i = nth.get(key) ?? 0;
      nth.set(key, i + 1);
      const x = c.x - w / 2 + 14 + i * 26, y = st.up ? c.y - hh / 2 : c.y + hh / 2;
      const gone = st.other ? `${st.up ? 'up' : 'down'} to ${st.other.name} (${floorName(st.other.height)})` : 'unexplored';
      tiles.append(s('g', { class: `map-stair${st.other ? '' : ' unknown'}${st.z.id === selected ? ' hot' : ''}`, ...(st.other ? { 'data-goto': st.other.id, tabindex: 0, role: 'button' } : exitAttrs(st.z.id, st.l.label)), 'aria-label': `${st.l.label}: ${gone}` },
        s('circle', { cx: x, cy: y, r: 11 }), s('text', { x, y: y + 4, 'text-anchor': 'middle' }, st.up ? '▲' : '▼'), s('title', {}, `${st.l.label}: ${gone}`)));
    }
    drawFloors();
    compass.hidden = !compassUsed;
    if (planned()) labels.append(scaleBar(zones, sp));
    vp.replaceChildren(bg, ...(landG ? [landG] : []), areas, links, tiles, labels);
    svg.setAttribute('aria-label', world === WORLD ? `The world as you know it: ${zones.length} place${zones.length === 1 ? '' : 's'}` : `Map of ${placeOf(world)?.name ?? 'this place'}: ${zones.length} zone${zones.length === 1 ? '' : 's'} known`);
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
  const measure: Measure = (t, kind) => {
    if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
    if (!measureCtx) return roughMeasure(t, kind);
    const st = TEXT[kind];
    // zone names are drawn in the rounded face (.map-name), the rest in the map's own
    const face = kind === 'label' ? getComputedStyle(svg).getPropertyValue('--font-round').trim() : '';
    measureCtx.font = `${st.weight} ${st.size}px ${face || getComputedStyle(svg).fontFamily || 'sans-serif'}`;
    return measureCtx.measureText(t).width + (kind === 'title' ? t.length * st.size * 0.06 : 0); // titles: .06em tracking
  };
  const innerPlaces = (zones: MapZone[]) => (cur?.places ?? []).filter((p) => rootOf(p.id) === world && p.id !== world).sort((a, b) => a.depth - b.depth)
    .map((p) => ({ id: p.id, name: p.name, depth: p.depth, zones: zones.filter((z) => inside(z.placeId, p.id)) })).filter((p) => p.zones.length);
  const sceneAt = (k: number) => planScene({ zones: floorZones(), every: worldZones(), places: innerPlaces(floorZones()), k, measure, visits: new Set(cur?.visited ?? []),
    awayName: (id) => { const z = allZones().find((x) => x.id === id); return z ? placeOf(rootOf(z.placeId))?.name : undefined; } });
  /** the scale bar under the map, in screen pixels: 10 m and its paces */
  const barOf = (sc: Scene, k: number) => ({ x: sc.bounds.x0, y: sc.bounds.y1 + 22, len: 10 * PX_PER_M * k });
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
    const zoneG = s('g', { class: 'map-zones' }), marks = s('g', { class: 'map-marks' });
    const zoneById = new Map(sc.zones.map((x) => [x.z.id, x]));
    const areas = sc.places.map((p) => {
      const on = p.id === focus, mine = !!cur && inside(cur.placeId, p.id);
      return s('g', { class: `map-area real${on ? ' on' : ''}${mine ? ' mine' : ''}`, 'data-area': p.id, tabindex: 0, role: 'button', 'aria-label': `${p.name}: a place on this map` },
        s('rect', { x: p.box.x0, y: p.box.y0, width: p.box.x1 - p.box.x0, height: p.box.y1 - p.box.y0, 'data-role': 'place', 'data-id': p.id }));
    });
    for (const x of sc.zones) zoneG.append(planZone(x.z, x.box, x.state));
    const links = sc.connectors.map((c) => s('line', { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, class: `map-link${c.sight ? '' : ' hidden-view'}${c.a === selected || c.b === selected ? ' hot' : ''}` }, s('title', {}, c.title)));
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
      if (t.you) { const g = pin(t.cx, t.cy, youAt?.title ?? 'You are here'); g.setAttribute('data-role', 'token'); g.setAttribute('data-id', 'you'); marks.append(g); continue; }
      const who = t.who!;
      marks.append(s('g', { class: `map-who plan-who${who.now ? '' : ' last'}${who.at ? ' at' : ''}`, 'data-zone': t.zoneId, 'data-who': who.id },
        s('g', { 'data-role': 'token', 'data-id': t.id }, s('circle', { cx: t.cx, cy: t.cy, r: t.r }), s('text', { x: t.cx, y: t.cy + 3, 'text-anchor': 'middle' }, whoInitial(who.name))),
        s('text', { x: t.cx + t.r + 4, y: t.cy + 4, class: 'map-who-label' }, who.name), s('title', {}, t.title)));
    }
    const bar = barOf(sc, k);
    const scale = s('g', { class: 'map-scale' }, s('line', { x1: bar.x, y1: bar.y, x2: bar.x + bar.len, y2: bar.y }), s('line', { x1: bar.x, y1: bar.y - 5, x2: bar.x, y2: bar.y + 5 }),
      s('line', { x1: bar.x + bar.len, y1: bar.y - 5, x2: bar.x + bar.len, y2: bar.y + 5 }), s('text', { x: bar.x + bar.len + 8, y: bar.y + 4 }, `${distText(10)} · ${Math.round(10 / CONFIG.PACE_M)} paces`));
    planLayer.replaceChildren(...areas, zoneG, names, ...links, marks, scale);
    drawLegend();
    scheduleCheck();
  }
  /** a zone to scale: its floor at its real size, each side drawn as its edge kind; a zone only seen, never stood in, is
   *  hatched (MAP-33, MAP-34: the state reads without colour) */
  function planZone(z: MapZone, b: { x0: number; y0: number; x1: number; y1: number }, state: string) {
    const cls = ['map-tile', 'plan', z.outdoor ? 'outdoor' : 'indoor', z.inView ? 'in-view' : 'remembered', state, z.here ? 'here' : '', z.id === walk?.toZone ? 'heading' : '', z.id === selected ? 'selected' : '', z.light === 'dark' ? 'dark' : ''].filter(Boolean).join(' ');
    const m2 = Math.round(z.rect!.w * z.rect!.d);
    const said = state === 'current' ? 'you are here' : state === 'explored' ? 'you have been here' : 'seen, not been in';
    const w = b.x1 - b.x0, hh = b.y1 - b.y0;
    // the drawn floor sits a hair inside its walls, so zones that share a wall never measure as overlapping (MAP-11)
    const g = s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}, ${m2} m², ${said}${z.id === walk?.toZone ? ', you are heading here' : ''}` },
      s('rect', { x: b.x0 + 0.5, y: b.y0 + 0.5, width: Math.max(0, w - 1), height: Math.max(0, hh - 1), class: 'map-tile-box', 'data-role': 'zone', 'data-id': z.id, 'data-parent': z.placeId }));
    if (state === 'seen') g.append(s('rect', { x: b.x0 + 0.5, y: b.y0 + 0.5, width: Math.max(0, w - 1), height: Math.max(0, hh - 1), class: 'map-tile-hatch' }));
    const sides: Record<string, [number, number, number, number]> = { n: [b.x0, b.y0, b.x1, b.y0], s: [b.x0, b.y1, b.x1, b.y1], w: [b.x0, b.y0, b.x0, b.y1], e: [b.x1, b.y0, b.x1, b.y1] };
    for (const [side, [x1, y1, x2, y2]] of Object.entries(sides)) {
      const kind = (z.edges as Record<string, string> | undefined)?.[side] ?? (z.outdoor ? EK.open : EK.wall);
      g.append(s('line', { x1, y1, x2, y2, class: `map-edge ${EDGE_CLASS[kind] ?? 'wall'}` }));
    }
    g.append(s('title', {}, `${z.name}: ${Math.round(z.rect!.w)} × ${Math.round(z.rect!.d)} m (${m2} m²), ${said}`));
    return g;
  }
  /** a door on the wall two zones share: plain, an opening between two outdoor zones, or its barrier's mark (locked, barred,
   *  blocked: MAP-33 shows locked on the door, not the zone); several on one wall as one badge with their count */
  function doorMark(d: Scene['doors'][number]) {
    const r = d.x1 - d.cx, attrs = { 'data-role': 'icon', 'data-id': d.id, role: 'img', 'aria-label': d.title };
    if (d.way?.shut) return s('g', { class: `map-way ${d.way.shut}${d.way.key ? ' key' : ''}`, ...attrs }, s('circle', { cx: d.cx, cy: d.cy, r }), ...wayGlyph(d.cx, d.cy, d.way.shut), s('title', {}, d.title));
    if (d.kind === 'group') return s('g', { class: 'map-door group', ...attrs }, s('circle', { cx: d.cx, cy: d.cy, r }), s('text', { x: d.cx, y: d.cy + 4, 'text-anchor': 'middle' }, String(d.count)), s('title', {}, d.title));
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
      ...item('state:current', sw('here'), 'Where you are'), ...item('you', h('i', { class: 'k-pin' }), 'You'),
      ...item('state:explored', sw('explored'), 'Been there'), ...item('state:seen', sw('seen'), 'Seen, not been in'),
      ...item('remembered', sw('faded'), 'Out of sight now'),
      ...item('outdoor', sw('outdoor'), 'Outdoors'), ...item('indoor', sw('indoor'), 'Indoors'),
      ...edge(EK.wall, 'wall', 'Wall'), ...edge(EK.low, 'low', 'Counter or fence'), ...edge(EK.window, 'window', 'Window'), ...edge(EK.open, 'open', 'Open side'),
      ...item('place', h('i', { class: 'k-area' }), 'A building or place inside this one'),
      ...item('door', svgKey(s('line', { x1: -10, y1: 0, x2: 10, y2: 0, class: 'map-edge wall' }), s('g', { class: 'map-door door' }, ...doorGlyph(0, 0, 'door'))), 'Door in a wall'),
      ...item('opening', svgKey(s('g', { class: 'map-door opening' }, ...doorGlyph(0, 0, 'opening'))), 'Way through, no door'),
      ...item('group', svgKey(s('g', { class: 'map-door group' }, s('circle', { cx: 0, cy: 0, r: 9 }), s('text', { x: 0, y: 4, 'text-anchor': 'middle' }, '4'))), 'Several doors on one wall'),
      ...item('way:locked', wayKey('locked'), 'Locked'), ...item('way:locked-key', wayKey('locked key'), 'Locked, you hold its key'),
      ...item('way:barred', wayKey('barred'), 'Barred'), ...item('way:blocked', wayKey('blocked'), 'Blocked'),
      ...item('link', h('i', { class: 'k-line' }), 'Way between zones apart, you can see across'), ...item('link-hidden', h('i', { class: 'k-line dashed' }), 'Way between zones apart, far side hidden'),
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
  /** To scale: the zone's floor, each side drawn as its edge kind (wall solid, low dashed, window double, open faint) */
  function planTile(z: MapZone, p: Pt) {
    const w = tw(z), hh = th(z), x = p.x - w / 2, y = p.y - hh / 2;
    const cls = ['map-tile', 'plan', z.outdoor ? 'outdoor' : 'indoor', z.inView ? 'in-view' : 'remembered', z.here ? 'here' : '', z.id === walk?.toZone ? 'heading' : '', z.id === selected ? 'selected' : '', z.light === 'dark' ? 'dark' : ''].filter(Boolean).join(' ');
    const m2 = Math.round(z.rect!.w * z.rect!.d);
    const g = s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}, ${m2} m²${z.here ? ', you are here' : z.id === walk?.toZone ? ', you are heading here' : ''}` },
      s('rect', { x, y, width: w, height: hh, class: 'map-tile-box' }));
    const sides: Record<string, [number, number, number, number]> = { n: [x, y, x + w, y], s: [x, y + hh, x + w, y + hh], w: [x, y, x, y + hh], e: [x + w, y, x + w, y + hh] };
    for (const [side, [x1, y1, x2, y2]] of Object.entries(sides)) {
      const kind = (z.edges as Record<string, string> | undefined)?.[side] ?? (z.outdoor ? EK.open : EK.wall);
      g.append(s('line', { x1, y1, x2, y2, class: `map-edge ${EDGE_CLASS[kind] ?? 'wall'}` }));
    }
    // FR5: the furniture at its own points, under the zone's name and people; hover names it
    for (const f of z.furniture ?? []) {
      const pad = 11, clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
      const fx = clamp(f.x * PX_PER_M, x + pad, x + w - pad), fy = clamp(-f.y * PX_PER_M, y + pad, y + hh - pad); // the disc stays inside its walls
      const mid = Math.abs(fx - p.x) < 16 && Math.abs(fy - p.y) < 16; // a piece in the middle steps below the name and people
      g.append(furnIcon(f.kind, cap(f.name), fx, mid ? p.y + (z.people.length ? 30 : 20) : fy));
    }
    // people in full sight stand at their own points; the rest (heard, glimpsed, last seen) sit in a row under the name
    const placed = z.people.filter((who) => who.at), row = z.people.filter((who) => !who.at);
    g.append(s('text', { x: p.x, y: p.y - (row.length ? 6 : 0) + 4, 'text-anchor': 'middle', class: 'map-tile-name' }, z.name),
      s('title', {}, `${z.name}: about ${Math.round(z.rect!.w)} × ${Math.round(z.rect!.d)} m (${m2} m²)`));
    row.slice(0, MAX_DOTS).forEach((who, i, all) => g.append(whoDot(who, z.id, p.x + (i - (all.length - 1) / 2) * 16, p.y + 14, who.now ? `${who.name}: somewhere in here` : `${who.name} (last seen)`)));
    for (const who of placed) {
      const pad = 7, clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
      g.append(whoDot(who, z.id, clamp(who.at!.x * PX_PER_M, x + pad, x + w - pad), clamp(-who.at!.y * PX_PER_M, y + pad, y + hh - pad), who.name, who.id));
    }
    // to scale you stand at your own point (Actor.pos), on a road too (TV7); with no position yet, at the corner
    if (z.here && z.you) youAt = { x: z.you.x * PX_PER_M, y: -z.you.y * PX_PER_M, title: z.along ? alongText(z.along) : 'You are here' };
    else if (z.here) g.append(pin(x + w - 2, y + 2));
    return g;
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
  /** a barrier you know stops you, as a small badge on its exit: a padlock (locked; green when you hold its key), a door with
   *  its bolt across (barred) or a cross (blocked) */
  function wayMark(x: number, y: number, l: MapLink, from: string, to: string) {
    const w = l.way!, shut = w.shut!;
    const said = `${l.label}: ${wayWords(w)}${to ? ` · ${from} to ${to}` : ''}`;
    return s('g', { class: `map-way ${shut}${w.key ? ' key' : ''}`, role: 'img', 'aria-label': said }, s('circle', { cx: x, cy: y, r: 10 }), ...wayGlyph(x, y, shut), s('title', {}, said));
  }
  function tile(z: MapZone, p: Pt, sub?: string) {
    if (planned() && z.rect && world !== WORLD) return planTile(z, p);
    if (planned() && z.rect) return worldPlanTile(z, p, sub ?? '');
    const w = tw(z), hh = th(z), x = p.x - w / 2, y = p.y - hh / 2;
    const cls = ['map-tile', world === WORLD ? 'world-place' : '', z.outdoor ? 'outdoor' : 'indoor', z.inView ? 'in-view' : 'remembered', z.here ? 'here' : '', z.id === walk?.toZone ? 'heading' : '', z.id === selected ? 'selected' : '', z.light === 'dark' ? 'dark' : ''].filter(Boolean).join(' ');
    const status = sub && !z.along ? sub : z.along ? `${distText(z.along.m)} of ${distText(z.along.len)}` : z.here ? 'You are here' : z.id === walk?.toZone ? `Heading here${Number.isFinite(walk.metres) ? ' · ' + distText(walk.metres) : ''}` : z.inView ? `In view${z.light ? ' · ' + z.light : ''}` : 'Remembered';
    const g = s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}, ${status}` },
      s('rect', { x, y, width: w, height: hh, rx: planned() ? 0 : 10, class: 'map-tile-box' }),
      s('text', { x: p.x, y: y + 24, 'text-anchor': 'middle', class: 'map-tile-name' }, z.name),
      s('text', { x: p.x, y: y + 42, 'text-anchor': 'middle', class: 'map-tile-sub' }, status));
    if (z.along) g.append(roadTrack(z.along, x, y + hh - 18, w)); // TV7: you, at your point along the road
    else if (z.people.length) {
      const shown = z.people.slice(0, MAX_DOTS), r = 10, gap = 6, total = shown.length * (2 * r) + (shown.length - 1) * gap + (z.people.length > MAX_DOTS ? 30 : 0);
      let cx = p.x - total / 2 + r;
      for (const who of shown) {
        g.append(s('g', { class: `map-who${who.now ? '' : ' last'}` }, s('circle', { cx, cy: y + 64, r }),
          s('text', { x: cx, y: y + 68, 'text-anchor': 'middle' }, whoInitial(who.name)),
          s('title', {}, who.now ? `${who.name} · here now` : `${who.name} · last seen here`)));
        cx += 2 * r + gap;
      }
      if (z.people.length > MAX_DOTS) g.append(s('text', { x: cx + 4, y: y + 68, class: 'map-tile-sub' }, `+${z.people.length - MAX_DOTS}`));
    }
    if (z.here && !z.along) g.append(pin(x + w - 2, y + 2));
    return g;
  }
  /** to scale, a person as a small disc with the initial of what you know them by; pointing at it shows the full name or
   *  description beside it */
  function whoDot(who: MapZone['people'][number], zoneId: string, cx: number, cy: number, title: string, id?: string) {
    return s('g', { class: `map-who plan-who${who.now ? '' : ' last'}${who.at ? ' at' : ''}`, 'data-zone': zoneId, ...(id ? { 'data-who': id } : {}) },
      s('circle', { cx, cy, r: 7 }), s('text', { x: cx, y: cy + 3, 'text-anchor': 'middle' }, whoInitial(who.name)),
      s('text', { x: cx + 11, y: cy + 4, class: 'map-who-label' }, who.name), s('title', {}, title));
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
    worldNames.push(road ? { x: mid ? mid.x * PX_PER_M : p.x, y: mid ? -mid.y * PX_PER_M : y, name: z.name, sub: z.line ? distText(lineLen) : z.rect ? distText(Math.max(z.rect.w, z.rect.d)) : sub, here: z.here, mid: true, ...(alt ? { alt } : {}) } : { x, y, y1: y + hh, name: z.name, sub, here: z.here });
    if (road) {
      // RD2: a road is one line along its length, with a wider invisible line under it so it is easy to click
      const ew = z.rect!.w >= z.rect!.d, len = distText(z.line ? lineLen : Math.max(z.rect!.w, z.rect!.d));
      const ends = ew ? { x1: x, y1: p.y, x2: x + w, y2: p.y } : { x1: p.x, y1: y, x2: p.x, y2: y + hh };
      const way = (cls2: string) => z.line ? s('polyline', { points: z.line.map((q) => `${q.x * PX_PER_M},${-q.y * PX_PER_M}`).join(' '), class: cls2, 'vector-effect': 'non-scaling-stroke' })
        : s('line', { ...ends, class: cls2, 'vector-effect': 'non-scaling-stroke' });
      return s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}, a road about ${len} long` },
        way('map-road-hit'), way('map-tile-box'), s('title', {}, `${z.name}: a road about ${len} long · click for where it goes`));
    }
    return s('g', { class: cls, 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': `${z.name}, ${sub}, about ${distText(z.rect!.w)} by ${distText(z.rect!.d)}` },
      s('rect', { x, y, width: w, height: hh, class: 'map-tile-box', 'vector-effect': 'non-scaling-stroke' }), s('title', {}, `${z.name}: about ${distText(z.rect!.w)} × ${distText(z.rect!.d)}`));
  }
  /** the "you are here" pin */
  function pin(cx: number, cy: number, title?: string) {
    const g = s('g', { class: 'map-pin' }, s('circle', { cx, cy, r: 9 }), s('circle', { cx, cy, r: 3.5, class: 'core' }));
    if (title) g.append(s('title', {}, title));
    return g;
  }
  /** TV7: a road drawn as a line from end to end with you at your point along it */
  function roadTrack(a: NonNullable<MapZone['along']>, x: number, y: number, w: number) {
    const x0 = x + 26, x1 = x + w - 26, at = x0 + (a.len ? a.m / a.len : 0) * (x1 - x0);
    return s('g', { class: 'map-road-track' }, s('line', { x1: x0, y1: y, x2: x1, y2: y }),
      s('text', { x: x0 - 8, y: y + 4, 'text-anchor': 'end' }, a.from[0].toUpperCase()), s('text', { x: x1 + 8, y: y + 4 }, a.to[0].toUpperCase()),
      pin(at, y, alongText(a)));
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
        h('div', { class: 'map-card-h' }, h('h2', {}, t.name), h('span', { class: `hs-tg ${t.here ? 'cap' : ''}` }, t.here ? 'You are here' : 'Road')),
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
    const card = world === WORLD ? (isRoad(selected) ? roadCard(selected) : worldCard()) : exitSel ? exitCard(exitSel) : z ? h('section', { class: 'map-card' },
      h('div', { class: 'map-card-h' }, h('h2', {}, z.name), h('span', { class: `hs-tg ${z.here ? 'cap' : ''}` }, z.here ? 'You are here' : z.inView ? 'In view' : 'Remembered')),
      h('p', { class: 'hs-note' }, placeOf(z.placeId)?.name ?? ''),
      z.id === walk?.toZone ? h('p', { class: 'map-heading', role: 'status' }, h('b', {}, 'Heading here'), ` · ${walkLeft(walk)}`) : '',
      !z.here && onMove ? h('button', { type: 'button', class: 'hs-btn-main map-move', 'data-move': z.id, title: 'Types the order in the action box for you to send', onclick: () => onMove(moveOrder(z.name)) }, 'Move to here') : '',
      h('p', { class: 'map-look' }, z.look || 'You have no picture of it.'),
      z.inView ? h('p', { class: 'hs-note' }, [z.outdoor ? 'Outdoors' : 'Indoors', z.light ? `${z.light} light` : '', z.cover ? `${z.cover} cover` : ''].filter(Boolean).join(' · ')) : h('p', { class: 'hs-note' }, 'Out of sight now, so light, people and things on the ground may have changed.'),
      h('p', { class: 'hs-label' }, 'Exits'),
      h('ul', { class: 'map-exits' }, z.links.map((l) => h('li', {},
        h('span', {}, l.label),
        h('span', { class: 'to' }, l.known ? `to ${zoneName(l.to) ?? 'a known zone'}${l.otherPlace ? ` (${l.otherPlace})` : ''}${climb(z, l.to)}` : 'unexplored',
          l.way ? h('span', { class: `map-exit-way${l.way.shut ? ` ${l.way.shut}` : ''}${l.way.key ? ' key' : ''}` }, ` · ${wayWords(l.way)}`) : ''),
        l.known ? h('button', { type: 'button', class: 'map-go', title: 'Show this zone', 'aria-label': `Show ${zoneName(l.to) ?? 'this zone'}`, onclick: () => goTo(l.to) }, '›') : ''))),
      z.people.length ? h('div', {}, h('p', { class: 'hs-label' }, 'People'), h('p', {}, ...z.people.map((p) => h('span', { class: 'hs-tg' + (p.now ? '' : ' faded') }, p.now ? p.name : `${p.name} (last seen)`)))) : '',
      z.furniture?.length ? h('div', {}, h('p', { class: 'hs-label' }, 'Furniture'), h('p', {}, ...z.furniture.map((f) => h('span', { class: 'hs-tg' }, cap(f.name))))) : '',
      z.items.length ? h('div', {}, h('p', { class: 'hs-label' }, 'On the ground'), h('p', {}, ...z.items.map((x) => h('span', { class: 'hs-tg' }, x)))) : '')
      : h('section', { class: 'map-card' }, h('p', { class: 'hs-note' }, 'Click a zone on the map to see what you know about it.'));
    const count = (p: MapPlace) => cur!.places.filter((q) => inside(q.id, p.id)).reduce((n, q) => n + q.zones.length, 0);
    const placeList = h('section', { class: 'map-places' }, h('p', { class: 'hs-label' }, 'Places you know'),
      h('ul', {}, cur!.places.map((p) => h('li', { style: `--d:${p.depth}` }, h('button', { type: 'button', class: 'map-place' + (p.id === focus && world !== WORLD ? ' on' : ''), onclick: () => show(p.id), 'aria-current': p.id === focus ? 'true' : undefined },
        h('span', { class: 'n' }, p.name, inside(cur!.placeId, p.id) ? h('span', { class: 'you' }, p.id === cur!.placeId ? ' · you' : '') : ''),
        h('span', { class: 'c' }, count(p) ? `${count(p)} zone${count(p) === 1 ? '' : 's'}` : 'no zones known'))))));
    const facts = pl?.facts.length ? h('section', {}, h('p', { class: 'hs-label' }, `What you know about ${pl.name}`), h('ul', { class: 'map-facts' }, pl.facts.map((f) => h('li', {}, f)))) : '';
    const legend = h('section', { class: 'map-legend' }, h('p', { class: 'hs-label' }, 'Key'),
      h('ul', {},
        h('li', {}, h('i', { class: 'k-tile outdoor' }), 'Outdoors'), h('li', {}, h('i', { class: 'k-tile indoor' }), 'Indoors'),
        h('li', {}, h('i', { class: 'k-tile remembered' }), 'Out of sight now'), h('li', {}, h('i', { class: 'k-pin' }), 'You'),
        h('li', {}, h('i', { class: 'k-line' }), 'You can see across'), h('li', {}, h('i', { class: 'k-line dashed' }), 'The far side is hidden'),
        h('li', {}, h('i', { class: 'k-line stub' }), 'Exit you have not taken'), h('li', {}, h('i', { class: 'k-area' }), 'A place inside this one'), h('li', {}, h('i', { class: 'k-line away' }), 'Road to another map'), h('li', {}, h('i', { class: 'k-stair' }, '▲'), 'Stairs up or down: click to change floor'),
        ...(planned() ? [h('li', {}, h('i', { class: 'k-edge wall' }), 'Wall'), h('li', {}, h('i', { class: 'k-edge low' }), 'Counter or fence'), h('li', {}, h('i', { class: 'k-edge window' }), 'Window'), h('li', {}, h('i', { class: 'k-edge open' }), 'Open side')] : []),
        ...(anyShut() ? [h('li', {}, wayKey('locked'), 'Locked'), h('li', {}, wayKey('locked key'), 'Locked, you hold its key'), h('li', {}, wayKey('barred'), 'Barred'), h('li', {}, wayKey('blocked'), 'Blocked')] : []),
        ...(anyFurniture() ? [h('li', {}, furnKey(), 'Furniture: point at one for its name')] : []),
        h('li', {}, h('i', { class: 'k-who' }), 'Someone there now'), h('li', {}, h('i', { class: 'k-who last' }), 'Last seen there'),
        // WZ4: the land, on the World to scale once you have made some out
        ...(world === WORLD && planned() && cur?.land?.length ? [h('li', {}, h('i', { class: 'k-land' }), 'Land you have seen: fields, woods…'), h('li', {}, h('i', { class: 'k-land-water' }), 'River or stream'),
          h('li', {}, h('i', { class: 'k-land-road' }), 'Road or track on the land'), h('li', {}, h('i', { class: 'k-site' }), 'Village or hamlet'),
          h('li', {}, h('i', { class: 'k-site faint' }), 'Known by word, not seen'), h('li', {}, h('i', { class: 'k-mark' }), 'Landmark')] : [])));
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
    if (!worldZones().length) { vp.replaceChildren(bg); empty.hidden = false; empty.textContent = world === WORLD ? 'You know no places yet.' : `You know of ${placeOf(world)!.name}, but none of its zones yet.`; compass.hidden = true; return; }
    empty.hidden = true;
    drawMap();
    apply();
  }

  function update() {
    const st = api.state();
    if (!st) { el.replaceChildren(h('h1', {}, 'Map'), h('p', { class: 'empty' }, 'No story yet. Create your character first.')); cur = null; return; }
    cur = knownMap(st);
    try { walk = st.player.walking ? buildPlayerView(st).player.walking : undefined; } catch { walk = undefined; }
    if (!el.contains(stage)) el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Map'), h('p', {}, 'Every zone you have stood in or seen, with the places inside places outlined; World shows every place you know and the roads between them. Only what your character knows.'))),
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
