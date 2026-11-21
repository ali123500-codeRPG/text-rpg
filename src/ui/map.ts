// Map page: the floor plan your character has seen (PZ12 a, BG-313), drawn to scale for the place you pick: each title's
// floor, walls, doorways and furniture only where the fog says you have seen, titles named on their outlines, and every
// way out you have not taken an arrow from its own doorway. The World shows each place you know at its real extent,
// joined by the roads you know. Drag to pan, wheel or the buttons to zoom. Clicking a zone shows it in the side column.
import type { GameApi, WalkingView } from '../types';
import { h } from './kit';
import { CONFIG } from '../config';
import { buildPlayerView, distText } from '../views';
import { walkLeft } from './doing';
import { landLayer, landLabels, type LandLabel } from './landSvg';
import { lineLength, SITE_SIZES, type SiteSize } from '../land/generate';
import { ICON_ART, type IconName } from './iconArt';
import { worldTiles, knownMap, peopleIn, pointAlong, rootPlace, type KnownMap, type MapLink, type MapPlace, type MapWay, type MapZone } from './mapData';
import { cap, theName } from '../words';
import { MAX_K, PIN_R, PIN_TIP, PX_PER_M } from './mapPlan';
import { planView, type PlanData, type PlanOpts } from './planView';
import { carriedS } from '../engine/speed';
import { dashMetres, ringMetres, type MapPick, type MinimapPoint } from './minimap';

/** PZ1, PZ2: a title's floor and the walls along its outline, in screen pixels: a metre point (x, y) goes to
 *  (dx + x·sc, dy − y·sc). floor is null for a plain rectangle, which keeps its box drawn a hair inside its walls (MAP-11) */
export function floorMarks(z: MapZone, sc: number, dx: number, dy: number): { floor: string | null; walls: SVGElement[] } {
  const at = (q: { x: number; y: number }) => [dx + q.x * sc, dy - q.y * sc];
  const o = z.outline ?? [], r = z.rect;
  const boxy = !r || o.length === 4 && o.every((q) => (Math.abs(q.x - (r.x - r.w / 2)) < 0.01 || Math.abs(q.x - (r.x + r.w / 2)) < 0.01) && (Math.abs(q.y - (r.y - r.d / 2)) < 0.01 || Math.abs(q.y - (r.y + r.d / 2)) < 0.01));
  // MAP-85: a stretch with a wall standing on it carries that wall, on a wider line that takes the click
  const walls = (z.walls ?? []).flatMap((w) => { const [x1, y1] = at(w.a), [x2, y2] = at(w.b); return [s('line', { x1, y1, x2, y2, class: `map-edge ${w.cls}` }) as SVGElement,
    ...(w.id ? [s('line', { x1, y1, x2, y2, class: 'map-edge-hit', 'data-thing': 'wall', 'data-of': w.id, 'data-zone': z.id, 'data-at': `${(w.a.x + w.b.x) / 2},${(w.a.y + w.b.y) / 2}` }) as SVGElement] : [])]; });
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
/** an icon of the set, px wide, centred on x, y: a settlement's by its size (MAP-71), a person's (MAP-69) */
export const iconMark = (name: IconName, x: number, y: number, px: number, cls = 'map-site-icon') => {
  const g = s('g', { class: cls });
  g.innerHTML = ICON_ART[name];
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
/** MAP-33: the fog's two tones as a mask: the seen ground faded, the ground in sight now (a title with no fog record:
 *  all of it) drawn full over it, each square a hair wider as in fogClip */
export function fogMask(id: string, zones: MapZone[], pxPerM: number): SVGElement {
  const pad = 1.5, whole = (z: MapZone) => (z.rect ? [{ x0: z.rect.x - z.rect.w / 2, x1: z.rect.x + z.rect.w / 2, y0: z.rect.y - z.rect.d / 2, y1: z.rect.y + z.rect.d / 2 }] : []);
  const rect = (cls: string) => (r: { x0: number; x1: number; y0: number; y1: number }) => s('rect', { class: cls, x: r.x0 * pxPerM - pad, y: -r.y1 * pxPerM - pad, width: (r.x1 - r.x0) * pxPerM + 2 * pad, height: (r.y1 - r.y0) * pxPerM + 2 * pad });
  return s('mask', { id, maskUnits: 'userSpaceOnUse', x: -1e6, y: -1e6, width: 2e6, height: 2e6 },
    ...zones.flatMap((z) => (z.seen ?? whole(z)).map(rect('map-fog-faded'))), ...zones.flatMap((z) => (z.sight ?? z.seen ?? whole(z)).map(rect('map-fog-now'))));
}
/** below this stage width, fitting a place never shrinks tiles past NARROW_MIN_K */
const NARROW_W = 640, NARROW_MIN_K = 0.75;
/** the "you are here" pin, on the Map and the minimap alike; its point shows the way you face (BG-18: left and right in
 *  orders are taken from it), none before you have walked */
export function pin(cx: number, cy: number, title?: string, facing?: [number, number], r = PIN_R) {
  // RM29 c: a pin shrunk where it would overlap keeps its point and core in proportion to its disc
  const a = facing ? Math.atan2(-facing[1], facing[0]) : null, at = (d: number, q: number) => `${cx + Math.cos(a! + d) * q} ${cy + Math.sin(a! + d) * q}`, f = r / PIN_R;
  const g = s('g', { class: 'map-pin' }, ...(a === null ? [] : [s('path', { class: 'face', d: `M${at(0, PIN_TIP * f)} L${at(0.5, r)} L${at(-0.5, r)}Z` })]),
    s('circle', { cx, cy, r }), s('circle', { cx, cy, r: 3.5 * f, class: 'core' }));
  if (title) { g.setAttribute('role', 'img'); g.setAttribute('aria-label', title); g.append(s('title', {}, title)); } // a mark with no visible words
  return g;
}
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
/** a door as a floor plan draws one, centred on x, y: `len` px along its wall and `thick` across, a leaf (a door) or a gap
 *  between two posts (a way through with no door); `dir` is the wall's run, h (east-west) or v; `wall`: a wall stands there. Under it an unseen line takes
 *  its click across the width a wall's does (.map-edge-hit), so a door as thin as its wall is as easy to hit as the wall */
export function doorGlyph(x: number, y: number, kind: 'door' | 'opening', dir: 'h' | 'v', len: number, thick: number, wall = true): SVGElement[] {
  const [w, hh] = dir === 'h' ? [len, thick] : [thick, len];
  const hit = s('line', dir === 'h' ? { x1: x - len / 2, y1: y, x2: x + len / 2, y2: y, class: 'map-edge-hit' } : { x1: x, y1: y - len / 2, x2: x, y2: y + len / 2, class: 'map-edge-hit' });
  const gap = s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, class: kind === 'door' ? 'leaf' : wall ? 'gap' : 'gap bare' }); // a gap's fill cuts its wall's line; on open ground there is none
  if (kind === 'door') return [hit, gap];
  const post = (x1: number, y1: number, x2: number, y2: number) => s('line', { x1, y1, x2, y2, class: 'post' });
  return dir === 'h' ? [hit, gap, post(x - w / 2, y - hh / 2, x - w / 2, y + hh / 2), post(x + w / 2, y - hh / 2, x + w / 2, y + hh / 2)]
    : [hit, gap, post(x - w / 2, y - hh / 2, x + w / 2, y - hh / 2), post(x - w / 2, y + hh / 2, x + w / 2, y + hh / 2)];
}
/** a barrier badge of radius r centred on x, y: its disc and its marks, drawn at radius 8 and scaled with it (RM28 a) */
export const wayBadge = (x: number, y: number, r: number, shut: NonNullable<MapWay['shut']>) =>
  s('g', { transform: `translate(${x} ${y}) scale(${r / 8})` }, s('circle', { cx: 0, cy: 0, r: 8 }), ...wayGlyph(0, 0, shut));
/** a barrier badge for the map's key */
const wayKey = (cls: string) => s('svg', { class: `k-way map-way ${cls}`, width: 20, height: 20, viewBox: '-10 -10 20 20', 'aria-hidden': 'true' },
  s('circle', { cx: 0, cy: 0, r: 9 }), ...wayGlyph(0, 0, cls.split(' ')[0] as NonNullable<MapWay['shut']>));

/** MAP-30: the Key button beside a map's zoom buttons, and the short list it opens; hidden when the map shows nothing
 *  unusual */
export function keyTool(cls: string) {
  const list = h('ul', { class: 'map-key', hidden: true, 'aria-label': 'Key' });
  const btn = h('button', { type: 'button', class: cls, 'aria-expanded': 'false', hidden: true, onclick: () => open(list.hidden) }, 'Key');
  const open = (on: boolean) => { list.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
  const set = (rows: [Node, string][]) => { list.replaceChildren(...rows.map(([mark, text]) => h('li', {}, mark, text))); btn.hidden = !rows.length; if (!rows.length) open(false); };
  return { btn, list, set };
}
/** MAP-30: a place map's key rows: only the unusual marks it shows (`used`, from the layout), in short words; the usual
 *  ones name themselves when pointed at */
export function planKeyRows(u: Set<string>): [Node, string][] {
  const row = (key: string | boolean, mark: () => Node, text: string): [Node, string][] => ((typeof key === 'string' ? u.has(key) : key) ? [[mark(), text]] : []);
  const stairs = (['stairs-up', 'stairs-down'] as const).filter((x) => u.has(x));
  return [
    ...row('remembered', () => h('i', { class: 'k-tile faded' }), 'Out of sight now'),
    ...row('edge:low', () => h('i', { class: 'k-edge low' }), 'Low wall or counter'),
    ...row('way:locked', () => wayKey('locked'), 'Locked'), ...row('way:locked-key', () => wayKey('locked key'), 'Locked, your key'),
    ...row('way:barred', () => wayKey('barred'), 'Barred'), ...row('way:blocked', () => wayKey('blocked'), 'Blocked'),
    ...row('exit', () => h('i', { class: 'k-line stub' }), 'Not been through yet'), ...row('exit-away', () => h('i', { class: 'k-line away' }), 'Opens another map'),
    ...row(stairs.length > 0, () => h('span', {}, ...stairs.map((x) => h('i', { class: 'k-stair' }, x === 'stairs-up' ? '▲' : '▼'))), 'Stairs'),
    ...row('who-last', () => h('i', { class: 'k-who last' }), 'Last seen here'),
  ];
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

/** MQ3: where the Map opens from the minimap (a zone's or exit's card, another map), taken at its next update */
let pick0: MapPick | null = null;
export const mapPick = (at?: MapPick) => { pick0 = at ?? null; };

/** onMove: "Move to here" on a zone's or an unexplored exit's card hands its order to Play's action box (typed, not sent) */
export function mapPage(api: GameApi, onMove?: (order: string) => void, onWalk?: (p: MinimapPoint) => void, onThing?: PlanOpts['onThing']) {
  const el = h('main', { class: 'map-page' });
  // one map per top-level place (a "world"): the village, the tavern in it and the field beside it share one layout,
  // each inner place drawn as an outlined area. `focus` is the place picked in the list or the crumbs.
  let focus = '', selected = '', lastHere = '';
  /** an unexplored exit picked on the map: its card offers Move to here */
  let exitSel: { zoneId: string; label: string } | null = null;
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
    s('marker', { id: 'map-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 10 5 0 10z', class: 'map-arrowhead' })));
  const bg = s('rect', { x: -6000, y: -6000, width: 12000, height: 12000, fill: 'url(#map-dots)', class: 'map-bg' });
  // to scale, your pin sits on its own layer at a fixed size, so it stays visible however far out a long road zooms (TV7)
  const youLayer = s('g', { class: 'map-you' }) as SVGGElement;
  let youAt: (Pt & { title: string }) | null = null;
  // to scale, the World's place names sit on their own layer at a fixed size, at each place's north-west corner, so they
  // stay readable when kilometres of road zoom the map far out
  const nameLayer = s('g', { class: 'map-world-names' }) as SVGGElement;
  let worldNames: { x: number; y: number; y1?: number; name: string; sub: string; here: boolean; mid?: true; alt?: (Pt & { steep: boolean })[]; icon?: SiteSize; id?: string }[] = [];
  // WZ4, to scale: the land you have made out lies under the World's places and roads, in metres like them. Each region's
  // markup is large, so it is built once per region and cells seen, and panning or zooming only moves it
  const landNodes = new Map<string, SVGGElement>();
  let landG: SVGGElement | null = null, landPx = 0;
  /** the settlements and landmarks on that land, on the name layer at a fixed size; a place drawn as a World tile is its own mark */
  let landNames: LandLabel[] = [];
  // to scale, a place's map is laid out by code at the zoom shown (mapPlan, rpg-map): zones, doors, labels, people and exit
  // notes on one layer in screen pixels, so no label or mark covers another at any zoom; panning only moves it
  svg.append(defs, vp, nameLayer, youLayer);
  const stage = h('div', { class: 'map-stage' });
  const side = h('aside', { class: 'map-side', 'aria-label': 'Map details' });
  const crumbs = h('nav', { class: 'map-crumbs', 'aria-label': 'Place' });
  const empty = h('p', { class: 'map-empty' });
  const zoomBtn = (label: string, title: string, f: () => void) => h('button', { type: 'button', class: 'map-btn', title, 'aria-label': title, onclick: f }, label);
  const worldKey = keyTool('map-btn map-key-btn');
  const tools = h('div', { class: 'map-tools' }, worldKey.list, worldKey.btn,
    zoomBtn('+', 'Zoom in', () => zoomBy(1.25)), zoomBtn('−', 'Zoom out', () => zoomBy(0.8)),
    zoomBtn('◎', 'Find me', () => findMe()), zoomBtn('⤢', 'Show the whole map', () => fit(world)));
  const floorBar = h('nav', { class: 'map-floors', 'aria-label': 'Floor' });
  // MAP-84 (MQ2 a): a place's map is the shared map view at its full size, the minimap's own component
  const pv = planView(api, {
    size: 'full', data: planData,
    onPlan: () => {}, onWalk: (p) => onWalk?.(p), onThing: (t, r) => onThing?.(t, r) ?? false,
    onCard: (zone) => { exitSel = null; selected = zone; focus = worldZones().find((x) => x.id === zone)?.placeId ?? focus; draw(); },
    onExit: (zone, label) => { selected = zone; exitSel = { zoneId: zone, label }; draw(); },
    onGoto: (target) => goTo(target), onArea: (id) => { focus = id; draw(); }, onExpand: () => fit(world),
  });
  /** what the shared view draws: this map's zones at the height shown, the places inside it, and you when you stand here */
  function planData(): PlanData | null {
    const st = api.state();
    if (!cur || !st || !planMap()) return null;
    const zs = floorZones().filter((z) => z.rect), here = zs.find((z) => z.here && z.you);
    const ring = here ? ringMetres(st) : null;
    const people = cur.people.filter((w) => w.root === world && Math.abs(w.height - floor()) < 0.01);
    return { km: cur, every: worldZones().filter((z) => z.rect), floor: zs, height: floor(), places: innerPlaces(zs), people,
      you: here ? { ...here.you! } : null, ...(here?.along ? { youTitle: alongText(here.along) } : {}), ...(facing ? { facing } : {}),
      ring, dash: here ? dashMetres(st) : null, carried: here ? carriedS(st, st.player, 'move') : 0,
      focus, selected, ...(walk?.toZone ? { heading: walk.toZone } : {}), exitSel,
      awayName: (id) => { const z = allZones().find((x) => x.id === id); return z ? placeOf(rootOf(z.placeId))?.name : undefined; },
      check: { place: placeOf(world)?.name, floor: floor() } };
  }
  /** the stage holds the shared view for a place's map, the World's own drawing for the World */
  const mountStage = () => { const want = planMap() ? [pv.el, crumbs, floorBar, empty] : [svg, crumbs, tools, floorBar, empty]; if (want.some((x, i) => stage.children[i] !== x) || stage.children.length !== want.length) stage.replaceChildren(...want); };
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
        ...(n.icon ? [((g) => (g.setAttribute('data-zone', n.id!), g.append(s('title', {}, `${n.name}, a ${n.icon}`)), g))(iconMark(n.icon, x + 11, y + 2, 24))] : []),
        s('text', { x: x + ic, y, class: 'map-tile-name', ...anchor }, n.name), s('text', { x: x + ic, y: y + 16, class: 'map-tile-sub', ...anchor }, n.sub))];
    });
    nameLayer.replaceChildren(...names, ...landMarksAt(v, taken));
    youLayer.replaceChildren(...(youAt && !planMap() ? [pin(v.x + youAt.x * v.k, v.y + youAt.y * v.k, youAt.title, facing)] : []));
  };
  const setView = (v: { x: number; y: number; k: number }) => { views.set(world, v); apply(); };
  /** the land's settlements and landmarks on screen: its size's icon (a diamond for a landmark) with its name above; one that would
   *  cover a place's name, your pin or a bigger settlement's name, or lies off the map, is left out (MAP-23) */
  function landMarksAt(v: { x: number; y: number; k: number }, taken: { x0: number; y0: number; x1: number; y1: number }[]) {
    const r = svg.getBoundingClientRect(), R = { town: 11, village: 10, hamlet: 7.5, feature: 4 };
    const out: SVGElement[] = [];
    for (const l of landNames) {
      const x = v.x + l.at.x * PX_PER_M * v.k, y = v.y - l.at.y * PX_PER_M * v.k, w = l.name.length * 6.6, rr = R[l.kind];
      const box = { x0: Math.min(x - rr, x - w / 2), y0: y - rr - 18, x1: Math.max(x + rr, x + w / 2), y1: y + rr };
      if (box.x0 < 0 || box.y0 < 0 || box.x1 > r.width || box.y1 > r.height || taken.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
      taken.push(box);
      const said = `${l.name}${l.kind === 'feature' ? '' : `, a ${l.kind}`}${l.faint ? ': known by word, not seen' : ''}`;
      out.push(s('g', { class: `map-land-mark ${l.kind}${l.faint ? ' faint' : ''}`, 'data-role': 'label', 'data-id': `land:${l.id}`, role: 'img', 'aria-label': said },
        l.kind === 'feature' ? s('rect', { x: x - rr, y: y - rr, width: 2 * rr, height: 2 * rr, transform: `rotate(45 ${x} ${y})` }) : iconMark(l.kind, x, y, 2 * rr),
        s('text', { x, y: y - rr - 5, 'text-anchor': 'middle' }, l.name), s('title', {}, said)));
    }
    return out;
  }
  // names are sized from measured text: once the map's own font has loaded, measure and lay the plan out again
  document.fonts?.ready.then(() => { if (planMap()) pv.render(); });
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
    if (planMap()) { pv.fit((z) => inside(z.placeId, placeId)); return; }
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
    focus = cur.placeId; selected = cur.zoneId; setFloorOf(cur.zoneId); draw();
    const me = hereZone()?.you;
    if (planMap() && me) pv.centreOn(me); else centre(cur.zoneId);
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
  function drawMap() {
    // every map is to scale (BG-313): each title, or in the World each place, at its real spot in metres
    const every = worldZones().filter((z) => z.rect), zones = floorZones().filter((z) => z.rect);
    const sp = new Map(every.map((z) => [z.id, { x: z.rect!.x * PX_PER_M, y: -z.rect!.y * PX_PER_M }]));
    spots.set(world, sp);
    if (planMap()) {
      // the shared view draws it all at the zoom shown (planView)
      vp.replaceChildren(bg);
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
  const innerPlaces = (zones: MapZone[]) => (cur?.places ?? []).filter((p) => rootOf(p.id) === world && p.id !== world).sort((a, b) => a.depth - b.depth)
    .map((p) => ({ id: p.id, name: p.name, depth: p.depth, zones: zones.filter((z) => inside(z.placeId, p.id)) })).filter((p) => p.zones.length);
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
    worldNames.push(road ? { x: mid ? mid.x * PX_PER_M : p.x, y: mid ? -mid.y * PX_PER_M : y, name: z.name, sub: z.line ? distText(lineLen) : z.rect ? distText(Math.max(z.rect.w, z.rect.d)) : sub, here: z.here, mid: true, ...(alt ? { alt } : {}) } : { x, y, y1: y + hh, name: z.name, sub, here: z.here, ...(size ? { icon: size, id: z.id } : {}) });
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
      const people = zs.flatMap((x) => peopleIn(cur!, x)), items = zs.flatMap((x) => x.items);
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
      peopleIn(cur!, z).length ? h('div', {}, h('p', { class: 'hs-label' }, 'People'), h('p', {}, ...peopleIn(cur!, z).map((p) => h('span', { class: 'hs-tg' + (p.now ? '' : ' faded') }, p.now ? p.name : `${p.name} (last seen)`)))) : '',
      z.furniture?.length ? h('div', {}, h('p', { class: 'hs-label' }, 'Furniture'), h('p', {}, ...z.furniture.map((f) => h('span', { class: 'hs-tg' }, cap(f.name))))) : '',
      z.items.length ? h('div', {}, h('p', { class: 'hs-label' }, 'On the ground'), h('p', {}, ...z.items.map((x) => h('span', { class: 'hs-tg' }, x)))) : '')
      : h('section', { class: 'map-card' }, h('p', { class: 'hs-note' }, 'Click a zone on the map to see what you know about it.'));
    const count = (p: MapPlace) => cur!.places.filter((q) => inside(q.id, p.id)).reduce((n, q) => n + q.zones.length, 0);
    const placeList = h('section', { class: 'map-places' }, h('p', { class: 'hs-label' }, 'Places you know'),
      h('ul', {}, cur!.places.map((p) => h('li', { style: `--d:${p.depth}` }, h('button', { type: 'button', class: 'map-place' + (p.id === focus && world !== WORLD ? ' on' : ''), onclick: () => show(p.id), 'aria-current': p.id === focus ? 'true' : undefined },
        h('span', { class: 'n' }, p.name),
        h('span', { class: 'c' }, count(p) ? `${count(p)} zone${count(p) === 1 ? '' : 's'}` : 'no zones known'))))));
    const facts = pl?.facts.length ? h('section', {}, h('p', { class: 'hs-label' }, `What you know about ${pl.name}`), h('ul', { class: 'map-facts' }, pl.facts.map((f) => h('li', {}, f)))) : '';
    // MAP-30: the World's key lists only what its look does not say: a settlement's size, one known by word, a landmark
    worldKey.set([...SITE_SIZES.filter((n) => worldNames.some((w) => w.icon === n) || landNames.some((l) => l.kind === n)).map((n) => [kSite(n), cap(n)] as [Node, string]),
      ...(landNames.some((l) => l.faint) ? [[kSite('village', ' faint'), 'Known by word, not seen'] as [Node, string]] : []),
      ...(landNames.some((l) => l.kind === 'feature') ? [[h('i', { class: 'k-mark' }), 'Landmark'] as [Node, string]] : [])]);
    side.replaceChildren(card, facts, placeList);
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
    if (!worldZones().length) { drawSide(); vp.replaceChildren(bg); empty.hidden = false; empty.textContent = world === WORLD ? 'You know no places yet.' : `You know of ${placeOf(world)!.name}, but none of its zones yet.`; return; }
    empty.hidden = true;
    mountStage();
    drawMap();
    drawSide();
    apply();
    if (planMap()) pv.update();
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
    // MQ3: opened from the minimap at a zone's card, an exit's card or another map
    const pk = pick0; pick0 = null;
    if (pk?.go) { draw(); goTo(pk.go); return; }
    const pz = pk?.zone ? allZones().find((x) => x.id === pk.zone) : undefined;
    if (pz) { world = mapOf(pz.placeId); focus = pz.placeId; selected = pz.id; setFloorOf(pz.id); exitSel = pk!.exit ? { zoneId: pz.id, label: pk!.exit } : null; }
    const fresh = !views.has(world) || world !== was; // a new map (onto a road, into a town) opens fitted
    draw();
    if (fresh) requestAnimationFrame(() => fit(planMap() ? world : focus)); // to scale, the whole map first: nothing past its edge (MAP-50)
    else if (moved) requestAnimationFrame(() => centre(cur!.zoneId));
  }
  return { el, update };
}
