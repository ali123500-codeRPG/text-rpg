// Map page: one map of everything your character knows (D-1558), drawn to scale by the shared map view (planView): each
// title's floor, walls, doorways and furniture only where the fog says you have seen, the land made out under them, and
// far out each place as its mark (MAP-76). Beside it the card of the zone or exit picked, and the places you know.
import type { GameApi, WalkingView } from '../types';
import { h } from './kit';
import { buildPlayerView, distText } from '../views';
import { walkLeft } from './doing';
import { lineLength, type SiteSize } from '../land/generate';
import { ICON_ART, type IconName } from './iconArt';
import { knownMap, peopleIn, rootPlace, type KnownMap, type MapPlace, type MapWay, type MapZone } from './mapData';
import { cap, theName } from '../words';
import { PIN_R, PIN_TIP } from './mapPlan';
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
export const kSite = (size: SiteSize, faint = '') => { const i = h('i', { class: `k-site${faint}` }); i.innerHTML = ICON_ART[size]; return i; };
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
export function fogClip(id: string, zones: MapZone[], pxPerM: number, o: Pt = { x: 0, y: 0 }): SVGElement {
  const pad = 1.5, rects = zones.flatMap((z) => (z.seen ?? (z.rect ? [{ x0: z.rect.x - z.rect.w / 2, x1: z.rect.x + z.rect.w / 2, y0: z.rect.y - z.rect.d / 2, y1: z.rect.y + z.rect.d / 2 }] : []))
    .map((r) => s('rect', { x: (r.x0 - o.x) * pxPerM - pad, y: -(r.y1 - o.y) * pxPerM - pad, width: (r.x1 - r.x0) * pxPerM + 2 * pad, height: (r.y1 - r.y0) * pxPerM + 2 * pad })));
  return s('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, ...rects);
}
/** MAP-33: the fog's two tones as a mask: the seen ground faded, the ground in sight now (a title with no fog record:
 *  all of it) drawn full over it, each square a hair wider as in fogClip */
export function fogMask(id: string, zones: MapZone[], pxPerM: number, o: Pt = { x: 0, y: 0 }): SVGElement {
  const pad = 1.5, whole = (z: MapZone) => (z.rect ? [{ x0: z.rect.x - z.rect.w / 2, x1: z.rect.x + z.rect.w / 2, y0: z.rect.y - z.rect.d / 2, y1: z.rect.y + z.rect.d / 2 }] : []);
  const rect = (cls: string) => (r: { x0: number; x1: number; y0: number; y1: number }) => s('rect', { class: cls, x: (r.x0 - o.x) * pxPerM - pad, y: -(r.y1 - o.y) * pxPerM - pad, width: (r.x1 - r.x0) * pxPerM + 2 * pad, height: (r.y1 - r.y0) * pxPerM + 2 * pad });
  return s('mask', { id, maskUnits: 'userSpaceOnUse', x: -1e6, y: -1e6, width: 2e6, height: 2e6 },
    ...zones.flatMap((z) => (z.seen ?? whole(z)).map(rect('map-fog-faded'))), ...zones.flatMap((z) => (z.sight ?? z.seen ?? whole(z)).map(rect('map-fog-now'))));
}
/** the "you are here" pin, on the Map and the minimap alike; its point shows the way you face (BG-18: left and right in
 *  orders are taken from it), none before you have walked */
export function pin(cx: number, cy: number, title?: string, facing?: [number, number], r = PIN_R) {
  // RM33 a, OM4b a: a pin of radius r is the whole pin scaled, its facing point, core and outline in proportion to its disc
  const a = facing ? Math.atan2(-facing[1], facing[0]) : null, at = (d: number, q: number) => `${Math.cos(a! + d) * q} ${Math.sin(a! + d) * q}`;
  const g = s('g', { class: 'map-pin', transform: `translate(${cx} ${cy}) scale(${r / PIN_R})` }, ...(a === null ? [] : [s('path', { class: 'face', d: `M${at(0, PIN_TIP)} L${at(0.5, PIN_R)} L${at(-0.5, PIN_R)}Z` })]),
    s('circle', { cx: 0, cy: 0, r: PIN_R }), s('circle', { cx: 0, cy: 0, r: 3.5, class: 'core' }));
  if (title) { g.setAttribute('role', 'img'); g.setAttribute('aria-label', title); g.append(s('title', {}, title)); } // a mark with no visible words
  return g;
}
/** TV7: how far along a road you are, e.g. "1.8 km from the west end of 4.5 km" */
export const alongText = (a: NonNullable<MapZone['along']>) => `${distText(a.m)} from the ${a.from} end of ${distText(a.len)}`;
/** a height as the floor buttons and stair tips name it */
export const floorName = (m: number) => (m === 0 ? 'Ground level' : `${Math.abs(m)} m ${m > 0 ? 'up' : 'down'}`);
const mode = (xs: number[]) => { const c = new Map<number, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
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
    ...row('exit', () => h('i', { class: 'k-line stub' }), 'Not been through yet'),
    ...row(stairs.length > 0, () => h('span', {}, ...stairs.map((x) => h('i', { class: 'k-stair' }, x === 'stairs-up' ? '▲' : '▼'))), 'Stairs'),
    ...row('who-last', () => h('i', { class: 'k-who last' }), 'Last seen here'),
  ];
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
  // D-1558: one map of everything known, each place inside a top-level place drawn as an outlined area, far out a
  // place's mark (MAP-76). `focus` is the place picked in the list
  let focus = '', selected = '', lastHere = '';
  /** an unexplored exit picked on the map: its card offers Move to here */
  let exitSel: { zoneId: string; label: string } | null = null;
  let cur: KnownMap | null = null;
  let facing: [number, number] | undefined; // the pin's point (BG-18)
  let walk: WalkingView | undefined; // AT49: the zone the player's walk is still headed for
  let shown = 0; // MAP-66: the height shown

  const stage = h('div', { class: 'map-stage' });
  const side = h('aside', { class: 'map-side', 'aria-label': 'Map details' });
  const empty = h('p', { class: 'map-empty' });
  const floorBar = h('nav', { class: 'map-floors', 'aria-label': 'Floor' });
  // MAP-84 (MQ2 a): the map is the shared map view at its full size, the minimap's own component
  const pv = planView(api, {
    size: 'full', data: planData,
    onPlan: () => {}, onWalk: (p) => onWalk?.(p), onThing: (t, r) => onThing?.(t, r) ?? false,
    onCard: (zone) => { exitSel = null; selected = zone; focus = allZones().find((x) => x.id === zone)?.placeId ?? focus; draw(); },
    onExit: (zone, label) => { selected = zone; exitSel = { zoneId: zone, label }; draw(); },
    onGoto: (target) => goTo(target), onArea: (id) => { focus = id; draw(); }, onExpand: () => pv.fit(),
    onRender: () => drawFloors(), // TD3 a: the ruler's stops are the heights in view, so a pan or zoom can change them
  });
  /** what the shared view draws: the zones at the height shown, the places inside them, and you when you stand there */
  function planData(): PlanData | null {
    const st = api.state();
    if (!cur || !st) return null;
    const zs = allZones().filter((z) => z.rect && z.height === shown), here = zs.find((z) => z.here && z.you);
    const ring = here ? ringMetres(st) : null;
    const people = cur.people.filter((w) => Math.abs(w.height - shown) < 0.01);
    return { km: cur, every: allZones().filter((z) => z.rect), floor: zs, height: shown, places: innerPlaces(zs), people,
      you: here ? { ...here.you! } : null, ...(here?.along ? { youTitle: alongText(here.along) } : {}), ...(facing ? { facing } : {}),
      ring, dash: here ? dashMetres(st) : null, carried: here ? carriedS(st, st.player, 'move') : 0,
      focus, selected, ...(walk?.toZone ? { heading: walk.toZone } : {}), exitSel,
      check: { place: placeOf(focus)?.name, floor: shown } };
  }
  stage.append(pv.el, floorBar, empty);

  const placeOf = (id: string) => cur?.places.find((p) => p.id === id);
  const rootOf = (id: string) => (cur ? rootPlace(cur, id) : id);
  /** Move to here's order for a zone; a zone in another town or building than the one you are in names it, so the order
   *  can't be read as a spot nearby ("I go to the village square in Thornbury") */
  const moveHere = (z: MapZone): string => {
    const to = rootOf(z.placeId), name = placeOf(to)?.name;
    return cur && name && rootOf(cur.placeId) !== to && name.toLowerCase() !== z.name.toLowerCase() ? `${moveOrder(z.name)} in ${theName(name)}` : moveOrder(z.name);
  };
  const inside = (id: string, anc: string) => { for (let p = placeOf(id), n = 0; p && n < 20; p = p.parentId ? placeOf(p.parentId) : undefined, n++) if (p.id === anc) return true; return false; };
  const allZones = () => (cur?.places ?? []).flatMap((p) => p.zones);
  /** the places inside a top-level place, outer first; a top-level place (a village, an estate) and a road (D-1558: ground
   *  like any other) have no outline here */
  const innerPlaces = (zones: MapZone[]) => (cur?.places ?? []).filter((p) => p.depth > 0 && p.kind !== 'road').sort((a, b) => a.depth - b.depth)
    .map((p) => ({ id: p.id, name: p.name, depth: p.depth, zones: zones.filter((z) => inside(z.placeId, p.id)) })).filter((p) => p.zones.length);

  function drawSide() {
    const z = allZones().find((x) => x.id === selected);
    const all = allZones();
    const zoneName = (id: string) => all.find((x) => x.id === id)?.name;
    const climb = (from: MapZone, to: string) => { const t = all.find((x) => x.id === to); const d = t ? t.height - from.height : 0; return d ? `, ${Math.abs(d)} m ${d > 0 ? 'up' : 'down'}` : ''; };
    const pl = placeOf(focus)!;
    // an unexplored exit: where it leaves from, and Move to here, which types the order to take it
    const exitCard = (x: { zoneId: string; label: string }) => {
      const from = all.find((q) => q.id === x.zoneId);
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
    // MAP-74 (OM6 a): a road's own facts on its card: how long it is, where you are along it, the places along it
    const roadLines = (z: MapZone) => {
      if (!z.road) return [];
      const road = placeOf(z.placeId), len = z.along?.len ?? (z.line ? lineLength(z.line) : z.rect ? Math.max(z.rect.w, z.rect.d) : 0);
      const along = road?.kind === 'road' ? cur!.places.filter((p) => p.parentId === road.id && p.zones.length) : [];
      return [len ? h('p', { class: 'hs-note' }, `A road about ${distText(len)} long`) : '',
        z.here && z.along ? h('p', { class: 'map-heading', role: 'status' }, h('b', {}, 'You are here'), ` · ${distText(z.along.m)} from its ${z.along.from} end`) : '',
        along.length ? h('div', {}, h('p', { class: 'hs-label' }, 'Along it'), h('ul', { class: 'map-exits' }, along.map((p) => h('li', {}, h('span', {}, p.name),
          h('button', { type: 'button', class: 'map-go', title: `Show ${p.name}`, 'aria-label': `Show ${p.name}`, onclick: () => show(p.id) }, '›'))))) : ''];
    };
    const card = exitSel ? exitCard(exitSel) : z ? h('section', { class: 'map-card' },
      // SD8: where you are is the gold outline and your token, said once; the place's name only when it differs from the zone's
      h('div', { class: 'map-card-h' }, h('h2', {}, z.name), z.here ? '' : h('span', { class: 'hs-tg' }, z.inView ? 'In view' : 'Remembered')),
      placeLine(z),
      ...roadLines(z),
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
      h('ul', {}, cur!.places.map((p) => h('li', { style: `--d:${p.depth}` }, h('button', { type: 'button', class: 'map-place' + (p.id === focus ? ' on' : ''), onclick: () => show(p.id), 'aria-current': p.id === focus ? 'true' : undefined },
        h('span', { class: 'n' }, p.name),
        h('span', { class: 'c' }, count(p) ? `${count(p)} zone${count(p) === 1 ? '' : 's'}` : 'no zones known'))))));
    const facts = pl?.facts.length ? h('section', {}, h('p', { class: 'hs-label' }, `What you know about ${pl.name}`), h('ul', { class: 'map-facts' }, pl.facts.map((f) => h('li', {}, f)))) : '';
    side.replaceChildren(card, facts, placeList);
  }

  function goTo(zoneId: string) {
    const z = allZones().find((x) => x.id === zoneId);
    if (!z) return;
    selected = zoneId; focus = z.placeId; shown = z.height;
    draw();
    if (z.rect) pv.centreOn(z.rect);
  }
  function setFloorOf(zoneId: string) { const z = allZones().find((x) => x.id === zoneId); if (z) shown = z.height; }
  /** MAP-66 (TD3 a): the height ruler, a bar to scale in metres from the lowest to the highest height in view, sky above the
   *  ground and earth below it (as Dwarf Fortress's depth bar), a notch at each height with a known room in view and a
   *  hollow one where only someone's point is; the shown height is the thumb, named beside it, and yours a mark on the bar.
   *  Dragging snaps to the nearest notch; the arrows, the keys and the wheel step notch to notch. Hidden with one height */
  let barKey = '', bar: { range: HTMLInputElement; now: HTMLElement; marks: HTMLElement[]; hs: number[]; pos(x: number): string } | null = null;
  function heightsInView() {
    const b = pv.viewM(), inb = (q: { x: number; y: number }) => q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1;
    const rooms = new Set(allZones().filter((z) => z.rect && z.rect.x + z.rect.w / 2 >= b.x0 && z.rect.x - z.rect.w / 2 <= b.x1 && z.rect.y + z.rect.d / 2 >= b.y0 && z.rect.y - z.rect.d / 2 <= b.y1).map((z) => z.height));
    const only = new Set(cur!.people.flatMap((p) => { const q = p.at ?? p.lastAt; return q && inb(q) && !rooms.has(p.height) ? [p.height] : []; }));
    return { rooms, only };
  }
  function drawFloors() {
    if (!cur) { floorBar.hidden = true; floorBar.replaceChildren(); barKey = ''; bar = null; return; }
    const { rooms, only } = heightsInView();
    const hs = [...new Set([...rooms, ...only, shown])].sort((a, b) => a - b);
    floorBar.hidden = hs.length < 2;
    if (hs.length < 2) { floorBar.replaceChildren(); barKey = ''; bar = null; return; }
    const mineH = allZones().find((z) => z.id === cur!.zoneId)?.height;
    const key = `${hs}|${[...only]}|${mineH}`;
    if (key !== barKey) {
      barKey = key;
      const lo = hs[0], hi = hs[hs.length - 1], t = (x: number) => (x - lo) / (hi - lo);
      // the thumb is 18 px: its middle runs from 9 px to the bar's height less 9 px
      const pos = (x: number) => `calc(9px + (var(--bar-h) - 18px) * ${t(x).toFixed(4)})`;
      const go = (x: number) => { if (x !== shown) { shown = x; draw(); } };
      const step = (d: number) => { const i = hs.indexOf(shown) + d; if (i >= 0 && i < hs.length) go(hs[i]); };
      const range = h('input', { type: 'range', class: 'map-floor-range', min: String(lo), max: String(hi), step: 'any', 'aria-label': 'Height shown',
        oninput: () => go(hs.reduce((a, b) => (Math.abs(b - +range.value) < Math.abs(a - +range.value) ? b : a))),
        onkeydown: (e: KeyboardEvent) => {
          const d = { ArrowUp: 1, ArrowRight: 1, PageUp: 1, ArrowDown: -1, ArrowLeft: -1, PageDown: -1 }[e.key];
          if (d) step(d); else if (e.key === 'Home') go(lo); else if (e.key === 'End') go(hi); else return;
          e.preventDefault();
        } }) as HTMLInputElement;
      const marks = hs.map((x) => h('span', { class: `map-floor-notch${rooms.has(x) ? '' : ' only'}`, style: `bottom:${pos(x)}`, 'aria-hidden': 'true' }));
      const you = mineH !== undefined && hs.includes(mineH) ? [h('span', { class: 'map-floor-you', style: `bottom:${pos(mineH)}`, 'data-tip': `You: ${floorName(mineH)}`, 'aria-hidden': 'true' })] : [];
      const now = h('output', { class: 'map-floor-now' });
      const groundLine = lo < 0 && hi > 0 ? [h('span', { class: 'map-floor-ground', style: `bottom:${pos(0)}`, 'aria-hidden': 'true' })] : [];
      const ground = lo >= 0 ? 0 : hi <= 0 ? 1 : t(0);
      const arrow = (d: number, label: string, glyph: string) => h('button', { type: 'button', class: 'map-floor-step', 'aria-label': label, 'data-tip': label, onclick: () => step(d) }, glyph);
      floorBar.replaceChildren(arrow(1, 'Up a height', '▲'),
        h('div', { class: 'map-floor-bar', style: `--bar-h:${Math.round(Math.min(240, Math.max(96, (hi - lo) * 6)))}px; --g:calc(9px + (var(--bar-h) - 18px) * ${ground.toFixed(4)})` }, range, ...marks, ...groundLine, ...you, now),
        arrow(-1, 'Down a height', '▼'));
      floorBar.onwheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); step(e.deltaY < 0 ? 1 : -1); };
      bar = { range, now, marks, hs, pos };
    }
    const b = bar!;
    b.range.value = String(shown);
    b.range.setAttribute('aria-valuetext', `${floorName(shown)}${shown === mineH ? ' · you' : ''}`);
    b.now.style.bottom = b.pos(shown);
    b.now.replaceChildren(floorName(shown), shown === mineH ? h('span', { class: 'you' }, ' · you') : '');
    b.marks.forEach((m, i) => m.classList.toggle('on', b.hs[i] === shown));
    (floorBar.firstChild as HTMLButtonElement).disabled = shown >= b.hs[b.hs.length - 1];
    (floorBar.lastChild as HTMLButtonElement).disabled = shown <= b.hs[0];
  }
  function show(id: string) {
    focus = id;
    const here = allZones().find((z) => z.here && inside(z.placeId, id));
    selected = here?.id ?? (selected && inside(allZones().find((z) => z.id === selected)?.placeId ?? '', id) ? selected : '');
    // the height: yours when you are in this place, else its ground (or the height with most of its zones)
    const zs = allZones().filter((z) => inside(z.placeId, id));
    if (here) shown = here.height;
    else if (zs.length && !zs.some((z) => z.height === shown)) shown = zs.some((z) => z.height === 0) ? 0 : mode(zs.map((z) => z.height));
    draw();
    requestAnimationFrame(() => pv.fit((z) => inside(z.placeId, id)));
  }

  function draw() {
    if (!cur) return;
    if (!placeOf(focus)) focus = cur.placeId;
    if (!allZones().length) { drawSide(); empty.hidden = false; empty.textContent = 'You know no places yet.'; return; }
    empty.hidden = true;
    drawSide();
    drawFloors();
    pv.update();
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
    const moved = cur.zoneId !== lastHere;
    if (moved) { lastHere = cur.zoneId; focus = cur.placeId; setFloorOf(cur.zoneId); selected = cur.zoneId; }
    // MQ3: opened from the minimap at a zone's card, an exit's card or another map
    const pk = pick0; pick0 = null;
    if (pk?.go) { draw(); goTo(pk.go); return; }
    const pz = pk?.zone ? allZones().find((x) => x.id === pk.zone) : undefined;
    if (pz) { focus = pz.placeId; selected = pz.id; setFloorOf(pz.id); exitSel = pk!.exit ? { zoneId: pz.id, label: pk!.exit } : null; }
    draw();
    // the map opens on you at the minimap's zoom (planView); after a move it keeps its zoom and centres on you again
    const me = allZones().find((z) => z.id === cur!.zoneId)?.you;
    if (moved && me) pv.centreOn(me);
  }
  return { el, update };
}
