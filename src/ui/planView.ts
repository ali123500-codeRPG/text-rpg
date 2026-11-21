// MAP-84 (MQ2 a): the map of a place, one component in two sizes. The minimap (Play's right column) and the Map pop-up are
// this same view: every mark, click and rule lives here once (MQ4 a), only the frame around it differs (the pop-up adds
// crumbs, key, places list, cards and the height slider). Code lays every mark out (planScene, rpg-map), this draws it
// to scale from what the character knows, and dev views check it (MAP-51). A click on the ground plans a walk to that
// exact point (MAP-81, AD16); a double-click, Enter or Just go walks; a right-click, or a long press on touch, opens the
// zone's card (MAP-64, MQ3, MQ7 a). In a fight the rings show how far a move slot walks and a dash runs (AD9, BF91).
// Nothing changes while a turn runs (M-06).
import type { GameApi } from '../types';
import { boxOf, fitInView, h, pointOf, tipOff, tipOn, viewSize } from './kit';
import { CONFIG } from '../config';
import type { KnownMap, MapZone } from './mapData';
import { MAX_K, PX_PER_M, TEXT, checkReach, checkStage, hitCap, nameFit, planScene, roughMeasure, type Box, type Measure, type Scene, type TextKind } from './mapPlan';
import { checkMap } from './mapCheck';
import { doorGlyph, fogClip, fogMask, iconMark, keyTool, planKeyRows, floorMarks, floorName, pin, wayGlyph } from './map';
import { furnIcon } from './furnitureIcons';
import { metresText, planTo, splitAt, zoneAt, type MinimapPlan, type MinimapPoint } from './minimap';
import { areaOf } from '../plan/geom';
import { distText } from '../views';
import { cap, r1 } from '../words';
import type { Pos } from '../engine/position';
import type { MapPeople, MapThing } from './deck';

export type PlanSize = 'mini' | 'full';
type Places = Parameters<typeof planScene>[0]['places'];
/** what the view draws, taken at update() and kept while a turn runs (M-06) */
export type PlanData = {
  km: KnownMap; every: MapZone[]; floor: MapZone[]; height: number; places: Places;
  /** where you stand (metres), when you stand on this floor of this map */
  you: Pos | null; youTitle?: string; facing?: [number, number];
  ring: number | null; dash: number | null; carried: number;
  focus?: string; selected?: string; heading?: string; exitSel?: { zoneId: string; label: string } | null;
  awayName(id: string): string | undefined;
  /** the dev checker's extra fields (the Map's place and floor) */
  check?: Record<string, unknown>;
};
export type PlanOpts = {
  size: PlanSize;
  data(): PlanData | null;
  onPlan(p: MinimapPoint | null): void;
  onWalk(p: MinimapPoint): void;
  /** MAP-85: a click on a person, door, wall, thing on the ground or piece of furniture: the deck's list for it beside the thing (its box in page pixels); false
   *  when the deck has nothing for it, and the click plans a walk as on bare ground */
  onThing(t: MapThing | MapPeople, anchor: ReturnType<typeof boxOf>): boolean;
  /** right-click or long press on a zone (MAP-64) */
  onCard(zoneId: string): void;
  /** an unexplored exit or stair picked (MAP-62) */
  onExit(zoneId: string, label: string): void;
  /** a way to another map, or known stairs (MAP-63) */
  onGoto(target: string): void;
  /** a place inside this one, by its outline or title */
  onArea?(placeId: string): void;
  /** the ⤢ tool: the minimap opens the Map, the Map shows the whole place */
  onExpand(): void;
  /** after each render (the Map's key reads what was drawn) */
  onRender?(): void;
};

const SVGNS = 'http://www.w3.org/2000/svg';
const s = (tag: string, attrs: Record<string, string | number> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};
const HINT = 'Point anywhere you know to see the way and how long it takes. Click to plan a move; double-click to walk there now. Right-click a zone for its card.';
const clip = (a: Box, b: Box): Box | null => {
  const c = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return c.x1 - c.x0 > 1 && c.y1 - c.y0 > 1 ? c : null;
};
const within = (a: Box, b: Box) => a.x0 >= b.x0 && a.y0 >= b.y0 && a.x1 <= b.x1 && a.y1 <= b.y1;
const same = (a: Box, b: Box) => Math.abs(a.x0 - b.x0) < 0.5 && Math.abs(a.y0 - b.y0) < 0.5 && Math.abs(a.x1 - b.x1) < 0.5 && Math.abs(a.y1 - b.y1) < 0.5;
let fogIds = 0;

export function planView(api: GameApi, opts: PlanOpts) {
  const full = opts.size === 'full';
  let d: PlanData | null = null, scene: Scene | null = null;
  /** the view: the zoom (k, the layout's scale) and where the layout's origin sits in the svg, in pixels */
  let k = 1, off = { x: 0, y: 0 }, placed = false, fitW = 0;
  let lastAt = '', lastRing: number | null = null;
  let hover: MinimapPlan | null = null, plan: Extract<MinimapPlan, { pts: Pos[] }> | null = null;

  // SD4: how to use it is the map's tip and name, not a line under it
  const svg = s('svg', { class: `mm-svg${full ? ' map-svg' : ''}`, tabindex: 0, role: 'group', 'aria-label': `${full ? 'Map' : 'Minimap'}. ${HINT}` }) as SVGSVGElement;
  const fogId = `pv-fog-${++fogIds}`;
  const world = s('g'), gFog = s('defs'), gAreas = s('g'), gZones = s('g', { class: 'map-zones', 'clip-path': `url(#${fogId})`, mask: `url(#${fogId}-now)` }), gNames = s('g', { class: 'map-names', 'aria-hidden': 'true' });
  const gRing = s('g'), gMarks = s('g', { class: 'map-marks' }), gPath = s('g'), gTokens = s('g');
  world.append(gFog, gAreas, gZones, gNames, gRing, gMarks, gPath, gTokens);
  svg.append(s('defs', {},
    s('marker', { id: `${fogId}-arrow`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 10 5 0 10z', class: 'map-arrowhead' }))),
  s('title', {}, HINT), world);
  const floorEl = h('span', { class: 'mm-floor' });
  const tool = (label: string, title: string, on: () => void, open?: string) => h('button', { type: 'button', 'data-tip': title, 'aria-label': title, 'data-open': open, onclick: on }, label);
  const key = full ? keyTool('mm-key-btn') : null; // MAP-30: the Map's key, beside its zoom buttons
  const say = h('span', { class: 'mm-say' }), carried = h('span', { class: 'mm-carry' });
  const go = h('button', { type: 'button', class: 'mm-go', hidden: true, onclick: () => plan && !api.busy() && opts.onWalk(point(plan)) }, 'Just go');
  const el = h('section', { class: `mm${full ? ' mm-full' : ''}`, 'aria-label': full ? 'Map of this place' : 'Minimap' },
    h('div', { class: 'mm-head' }, floorEl,
      ...(key ? [key.list] : []), h('span', { class: 'mm-tools' }, ...(key ? [key.btn] : []), tool('+', 'Zoom in', () => zoom(-1)), tool('−', 'Zoom out', () => zoom(1)), tool('◎', full ? 'Find me' : 'Back to you', recentre),
        full ? tool('⤢', 'Show the whole map', () => opts.onExpand()) : tool('⤢', 'Open the full map', () => opts.onExpand(), 'map'))),
    svg, h('div', { class: 'mm-foot' }, say, go, carried));

  // the hover text is the game's tip (A7): a browser title tip can't be timed, so each <title> becomes its parent's
  // data-tip (and its name, if it has none)
  const untitle = () => svg.querySelectorAll('title').forEach((t) => {
    const p = t.parentElement!;
    p.setAttribute('data-tip', t.textContent ?? '');
    if (!p.hasAttribute('aria-label')) p.setAttribute('aria-label', t.textContent ?? '');
    t.remove();
  });
  const tipEl = h('div', { class: 'rail-tip', role: 'tooltip', hidden: true });
  el.append(tipEl);
  let at = { x: 0, y: 0 };
  const tipped = (e: Event) => { const t = (e.target as Element).closest?.('[data-tip]'); return t && el.contains(t) ? t : null; };
  // right of the point, or left of it where the window's edge is near (the minimap sits at the right edge, BG-357)
  const showTip = (t: Element, x: number, y: number) => {
    tipEl.textContent = t.getAttribute('data-tip'); tipEl.hidden = false;
    const w = tipEl.offsetWidth;
    fitInView(tipEl, x + 14 + w + 16 > viewSize().w ? x - 14 - w : x + 14, y - tipEl.offsetHeight / 2);
  };
  const hideTip = () => tipOff(() => { tipEl.hidden = true; });
  el.addEventListener('pointermove', (e) => { at = pointOf(e); });
  el.addEventListener('pointerover', (e) => {
    const t = tipped(e);
    at = pointOf(e);
    if (t) tipOn(() => showTip(t, at.x, at.y)); else hideTip();
  });
  el.addEventListener('focusin', (e) => { const t = tipped(e); if (t) tipOn(() => { const r = boxOf(t); showTip(t, r.right, r.top + r.height / 2); }, true); });
  for (const ev of ['pointerleave', 'pointerdown', 'focusout', 'wheel']) el.addEventListener(ev, hideTip);
  untitle();

  const point = (p: MinimapPoint): MinimapPoint => ({ zone: p.zone, x: p.x, y: p.y, metres: p.metres, seconds: p.seconds, turns: p.turns, label: p.label });
  const size = () => ({ w: svg.clientWidth || 420, h: svg.clientHeight || 360 });
  /** screen pixels per metre */
  const K = () => k * PX_PER_M;
  const px = (q: Pos) => ({ x: q.x * K(), y: -q.y * K() });

  // a text's width and line height measured in the browser (MAP-51: real sizes, so the layout and the check agree)
  let ctx: CanvasRenderingContext2D | null | undefined;
  const font = (kind: TextKind) => {
    if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (!ctx) return null;
    const st = TEXT[kind], face = kind === 'label' ? getComputedStyle(svg).getPropertyValue('--font-round').trim() : '';
    ctx.font = `${st.weight} ${st.size}px ${face || getComputedStyle(svg).fontFamily || 'sans-serif'}`;
    return ctx;
  };
  const measure: Measure = Object.assign((t: string, kind: TextKind) => {
    const c = font(kind);
    return c ? c.measureText(t).width + (kind === 'title' ? t.length * TEXT[kind].size * 0.06 : 0) : roughMeasure(t, kind); // titles: .06em tracking
  }, { line: (kind: TextKind) => {
    const m = font(kind)?.measureText('');
    return m ? { ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent } : roughMeasure.line(kind);
  } });
  const sceneAt = (kk: number) => planScene({ zones: d!.floor, every: d!.every, places: d!.places, k: kk, measure, awayName: d!.awayName });

  /** a zone to scale: its floor at its real size, each side drawn as its edge kind; no zone state (MAP-33): the fog's
   *  two tones say what is in sight now, and the zone you stand in has no outline, even when its card is open */
  function planZone(z: MapZone, b: Box, c: Box) {
    const cls = ['map-tile', 'plan', z.outdoor ? 'outdoor' : 'indoor', z.id === d?.heading ? 'heading' : '', z.id === d?.selected && !z.here ? 'selected' : '', z.light === 'dark' ? 'dark' : ''].filter(Boolean).join(' ');
    const m2 = Math.round(z.outline?.length ? areaOf(z.outline) : z.rect!.w * z.rect!.d);
    const w = b.x1 - b.x0, hh = b.y1 - b.y0;
    // the drawn floor sits a hair inside its walls, so zones that share a wall never measure as overlapping (MAP-11)
    const fm = floorMarks(z, z.rect!.w ? w / z.rect!.w : PX_PER_M, 0, 0), tag = { 'data-role': 'zone', 'data-id': z.id, 'data-parent': z.placeId };
    const box = (cls2: string, extra = {}) => fm.floor ? s('polygon', { points: fm.floor, class: cls2, ...extra }) : s('rect', { x: b.x0 + 0.5, y: b.y0 + 0.5, width: Math.max(0, w - 1), height: Math.max(0, hh - 1), class: cls2, ...extra });
    // MAP-50: nothing tagged past the edge: a zone partly in view is tagged by the part in view, drawn whole
    const cut = !same(c, b), g = s('g', { class: cls, 'data-zone': z.id, ...(z.here ? { 'aria-current': 'location' } : {}), 'aria-label': `${z.name}, ${m2} m²${z.id === d?.heading ? ', you are heading here' : ''}` }, box('map-tile-box', cut ? {} : tag),
      ...(cut ? [s('rect', { x: c.x0 + 0.5, y: c.y0 + 0.5, width: Math.max(0, c.x1 - c.x0 - 1), height: Math.max(0, c.y1 - c.y0 - 1), class: 'mm-tag', ...tag })] : []));
    g.append(...fm.walls, s('title', {}, `${cap(z.name)}: ${Math.round(z.rect!.w)} × ${Math.round(z.rect!.d)} m`));
    return g;
  }
  const textMark = (b: { x0: number; y0: number; x1: number; y1: number; full: string; cut: boolean; lines: string[] }, cls: string, attrs: Record<string, string | number>, kind: 'label' | 'title' | 'note') => {
    const st = TEXT[kind], first = (b.y0 + b.y1) / 2 - ((b.lines.length - 1) * st.line) / 2 + st.size * 0.36, x = (b.x0 + b.x1) / 2;
    return s('g', { class: cls, ...attrs, ...(b.cut ? { 'aria-label': b.full } : {}) },
      s('rect', { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, rx: kind === 'note' ? 9 : 4 }),
      s('text', { x, y: first, 'text-anchor': 'middle' }, ...b.lines.map((line, i) => s('tspan', { x, y: first + i * st.line }, line))),
      ...(b.cut ? [s('title', {}, b.full)] : []));
  };
  const exitAttrs = (zoneId: string, label: string) => ({ 'data-exit': label, 'data-exit-from': zoneId, tabindex: 0, role: 'button', 'aria-label': `${label}: unexplored, click for Move to here` });

  function render() {
    for (const g of [gAreas, gZones, gNames, gRing, gMarks, gTokens]) g.replaceChildren();
    gFog.replaceChildren();
    if (!d) { scene = null; gPath.replaceChildren(); foot(); return; }
    const { w, h: hh } = size();
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    world.setAttribute('transform', `translate(${off.x} ${off.y})`);
    const vb: Box = { x0: -off.x, y0: -off.y, x1: w - off.x, y1: hh - off.y }, inView: Box = { x0: vb.x0 + 1, y0: vb.y0 + 1, x1: vb.x1 - 1, y1: vb.y1 - 1 };
    const sc = (scene = sceneAt(k));
    gFog.append(fogClip(fogId, sc.zones.map((x) => x.z), K()), fogMask(`${fogId}-now`, sc.zones.map((x) => x.z), K())); // BG-313: only ground the character has seen; MAP-33: in sight now full, the rest faded
    for (const p of sc.places) {
      const c = clip(p.box, vb);
      if (!c) continue;
      const cut = !same(c, p.box), r = (q: Box, extra = {}) => s('rect', { x: q.x0, y: q.y0, width: q.x1 - q.x0, height: q.y1 - q.y0, ...extra });
      gAreas.append(s('g', { class: `map-area real${p.id === d.focus ? ' on' : ''}`, 'data-area': p.id, 'aria-label': `${p.name}: a place on this map` },
        s('path', { d: p.outline, ...(cut ? {} : { 'data-role': 'place', 'data-id': p.id }) }), ...(cut ? [r(c, { class: 'mm-tag', 'data-role': 'place', 'data-id': p.id })] : [])));
    }
    const labels = new Map(sc.labels.map((l) => [l.zoneId, l]));
    /** each name as drawn: a name partly out of view is fitted again to the part of its seen room in view (BG-348), so furniture is checked again */
    const names: Box[] = [];
    for (const x of sc.zones) {
      const c = clip(x.box, vb), z = x.z;
      if (!c) continue;
      gZones.append(planZone(z, x.box, c));
      // MZ2: each zone's name behind every mark, in the part of its seen room in view; none where it does not fit (MAP-20)
      const l = labels.get(z.id), lc = l && clip(l.room, vb);
      const n = !lc ? null : same(lc, l.room) ? l : nameFit(z.name, lc, measure); // BG-313, BG-348: never on ground not seen
      if (!n) continue;
      const cx = (n.x0 + n.x1) / 2;
      names.push(n);
      gNames.append(s('text', { class: 'map-name', x: cx, y: n.base, 'text-anchor': 'middle', 'font-size': TEXT.label.size,
        'data-role': 'label', 'data-layer': 'back', 'data-id': `label:${z.id}`, 'data-for': z.id, 'data-placement': 'inside' },
      ...n.lines.map((line, i) => s('tspan', { x: cx, y: n.base + i * TEXT.label.line }, line))));
    }
    // AD9: how far one move slot walks this turn; BF91: and how far a dash runs, a second, wider ring
    if (d.you) {
      const y = px(d.you);
      if (d.dash !== null) gRing.append(s('circle', { class: 'mm-ring dash', cx: y.x, cy: y.y, r: d.dash * K() }, s('title', {}, `A dash this turn: ${metresText(d.dash)}`)));
      if (d.ring !== null) gRing.append(s('circle', { class: 'mm-ring', cx: y.x, cy: y.y, r: d.ring * K() }, s('title', {}, `A walk this turn: ${metresText(d.ring)}`)));
    }
    // marks, each only when it is whole in view (MAP-50: nothing tagged past the edge)
    for (const dd of sc.doors) {
      if (!within(dd, inView)) continue;
      const r = dd.x1 - dd.cx, tag = { 'data-role': 'icon', 'data-id': dd.id, role: 'img', 'aria-label': dd.title, 'data-thing': 'door', 'data-of': dd.zones.join('|') };
      gMarks.append(dd.way?.shut ? s('g', { class: `map-way ${dd.way.shut}${dd.way.key ? ' key' : ''}`, ...tag }, s('circle', { cx: dd.cx, cy: dd.cy, r }), ...wayGlyph(dd.cx, dd.cy, dd.way.shut), s('title', {}, dd.title))
        : s('g', { class: `map-door ${dd.kind}`, ...tag }, ...doorGlyph(dd.cx, dd.cy, dd.kind, dd.dir), s('title', {}, dd.title)));
    }
    for (const p of sc.places) if (within(p.title, inView)) gMarks.append(textMark(p.title, `map-place-title${p.id === d.focus ? ' on' : ''}`, { 'data-role': 'label', 'data-id': `place:${p.id}`, 'data-for': p.id, 'data-placement': 'outside', 'data-area': p.id }, 'title'));
    for (const e of sc.exits) {
      // BG-349: the arrow is part of the mark, so it too must be whole in view (its shaft's box, as the layout takes it)
      if (!within(e.note, inView) || !within({ x0: Math.min(e.x1, e.x2) - 3, y0: Math.min(e.y1, e.y2) - 3, x1: Math.max(e.x1, e.x2) + 3, y1: Math.max(e.y1, e.y2) + 3 }, inView)) continue;
      const open = e.goto ? {} : exitAttrs(e.zoneId, e.target);
      const on = d.exitSel?.zoneId === e.zoneId && d.exitSel.label === e.target ? ' picked' : '';
      gMarks.append(s('g', { class: `map-exit${e.goto ? ' away' : ' open'}${e.zoneId === d.selected ? ' hot' : ''}${on}`, 'data-role': 'exit', 'data-id': e.id, 'data-target': e.target, ...(e.goto ? { 'data-goto': e.goto } : open) },
        s('line', { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, 'marker-end': `url(#${fogId}-arrow)` }), s('title', {}, e.title)));
      gMarks.append(textMark(e.note, `map-note${e.goto ? ' away' : ' open'}${e.way?.shut ? ` ${e.way.shut}` : ''}${on}`, { 'data-role': 'label', 'data-id': `note:${e.id}`, 'data-for': e.zoneId, 'data-placement': 'outside', ...(e.goto ? { 'data-goto': e.goto, tabindex: 0, role: 'button', 'aria-label': `${e.title}: open it` } : open) }, 'note'));
    }
    for (const st of sc.stairs) if (within(st, inView)) gMarks.append(s('g', { class: `map-stair${st.goto ? '' : ' unknown'}${st.zoneId === d.selected ? ' hot' : ''}`, 'data-role': 'icon', 'data-id': st.id, ...(st.goto ? { 'data-goto': st.goto, tabindex: 0, role: 'button' } : exitAttrs(st.zoneId, st.label)), 'aria-label': st.title },
      s('circle', { cx: st.cx, cy: st.cy, r: st.x1 - st.cx }), s('text', { x: st.cx, y: st.cy + 4, 'text-anchor': 'middle' }, st.up ? '▲' : '▼'), s('title', {}, st.title)));
    // MAP-22, MAP-25: furniture never covers a zone's name; where it would, it is left off in its own spot
    for (const f of sc.furniture) if (within(f, inView) && !names.some((b) => b.x0 < f.x1 && f.x0 < b.x1 && b.y0 < f.y1 && f.y0 < b.y1)) {
      const g = furnIcon(f.kind, cap(f.name), f.cx, f.cy);
      for (const [k0, v] of Object.entries({ 'data-role': 'icon', 'data-id': f.id, 'data-thing': 'furniture', 'data-of': f.id.slice(5), 'data-is': f.kind, tabindex: '0', role: 'button' })) g.setAttribute(k0, v);
      gMarks.append(g);
    }
    // MAP-86: things on the ground, each its item icon on a disc, tinted by its kind
    for (const it of sc.items) {
      if (!within(it, inView)) continue;
      const r = it.x1 - it.cx;
      gMarks.append(s('g', { class: 'map-item', ...(it.kind ? { 'data-kind': it.kind } : {}), 'data-role': 'icon', 'data-id': it.id, 'data-thing': 'item', 'data-of': it.of, tabindex: 0, role: 'button', 'aria-label': `${cap(it.name)}: what to do` },
        s('circle', { class: 'disc', cx: it.cx, cy: it.cy, r }), iconMark(it.icon, it.cx, it.cy, r * 1.24, 'art'), s('title', {}, cap(it.name))));
    }
    for (const t of sc.tokens) {
      if (!within(t, inView)) continue;
      if (t.you) { const g = pin(t.cx, t.cy, d.youTitle ?? 'You are here', d.facing); g.setAttribute('data-role', 'token'); g.setAttribute('data-id', 'you'); gTokens.append(g); continue; }
      const who = t.who!, c = t.cap, tok = { 'data-role': 'token', 'data-id': t.id };
      // BG-324: the disc (GSM-193: or the body's capsule) alone is the token the checker measures; its icon (MAP-69) sits inside it
      const capRect = (q: NonNullable<typeof c>, at: Record<string, string | number>) => s('rect', { x: t.cx - q.len / 2, y: t.cy - q.wide / 2, width: q.len, height: q.wide, rx: Math.min(q.len, q.wide) / 2, transform: `rotate(${q.deg} ${t.cx} ${t.cy})`, ...at });
      const shape = c ? capRect(c, tok) : s('circle', { cx: t.cx, cy: t.cy, r: t.r, ...tok });
      // RM17 b: a capsule narrower than the disc keeps the disc's width to click on, unseen; its icon shrinks to fit inside it
      const hitArea = c && c.wide < 2 * t.r ? [capRect(hitCap(c), { class: 'map-who-hit' })] : [];
      const turn = c ? Math.abs(Math.cos((c.deg * Math.PI) / 180)) + Math.abs(Math.sin((c.deg * Math.PI) / 180)) : 1;
      const iconPx = (2 * t.r - 4) * Math.min(1, (c ? Math.min(c.len, c.wide) : 2 * t.r) / (2 * t.r) / turn);
      // RM27 b: a disc for a group is one token with its "+n" badge, and its click picks one of them first
      const b = t.badge, many: Record<string, string> = t.group ? { 'data-thing': 'people', 'data-of': t.group.map((w) => w.id).join('|'), 'data-names': t.group.map((w) => w.name).join('|') } : { 'data-thing': 'person', 'data-of': who.id };
      const g = s('g', { class: `map-who plan-who${who.now && !who.lastAt ? '' : ' last'}${who.at ? ' at' : ''}`, 'data-zone': t.zoneId, ...many, tabindex: 0, role: 'button', 'aria-label': `${t.title}: what to do` },
        ...(t.ring ? [s('circle', { class: 'map-who-ring', cx: t.ring.cx, cy: t.ring.cy, r: t.ring.r })] : []),
        // the checker measures the disc and the badge's pill; the letters' ink sits inside the pill
        s('g', b ? tok : {}, ...hitArea, b ? s('circle', { cx: t.cx, cy: t.cy, r: t.r }) : shape, iconMark(who.icon, t.cx, t.cy, iconPx, 'map-who-icon'),
          ...(b ? [s('rect', { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, rx: (b.y1 - b.y0) / 2 })] : [])),
        ...(b ? [s('text', { x: (b.x0 + b.x1) / 2, y: t.cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'aria-hidden': 'true' }, b.text)] : []),
        s('text', { x: t.x1 + 4, y: t.cy + 4, class: 'map-who-label' }, t.group ? t.title : who.name), s('title', {}, t.title));
      gTokens.append(g);
    }
    // the scale bar under the plan: 10 m and its paces
    const len = 10 * K(), bx = Math.max(sc.bounds.x0, sc.bounds.x1 - len - 120), by = sc.bounds.y1 + 22;
    if (within({ x0: bx, y0: by - 6, x1: bx + len + 90, y1: by + 6 }, inView)) gMarks.append(s('g', { class: 'map-scale' }, s('line', { x1: bx, y1: by, x2: bx + len, y2: by }), s('line', { x1: bx, y1: by - 5, x2: bx, y2: by + 5 }),
      s('line', { x1: bx + len, y1: by - 5, x2: bx + len, y2: by + 5 }), s('text', { x: bx + len + 8, y: by + 4 }, `${distText(10)} · ${Math.round(10 / CONFIG.PACE_M)} paces`)));
    drawPath();
    foot();
    untitle();
    scheduleCheck();
    key?.set(planKeyRows(sc.used));
    opts.onRender?.();
  }

  /** the hovered walk (dotted, amber past what this turn walks) and the planned one (solid), each with its end */
  function drawPath() {
    gPath.replaceChildren();
    if (!d) return;
    const ring = d.ring;
    const line = (pts: Pos[], cls: string) => s('polyline', { class: cls, points: pts.map((q) => { const p = px(q); return `${p.x},${p.y}`; }).join(' ') });
    for (const [p, set] of [[plan, true], [hover && 'pts' in hover ? hover : null, false]] as const) {
      if (!p) continue;
      const [now, later] = ring === null ? [p.pts, []] : splitAt(p.pts, ring), end = px(p.pts[p.pts.length - 1]), cls = `mm-path${set ? ' set' : ''}`;
      gPath.append(line(now, cls), ...(later.length > 1 ? [line(later, `${cls} far`)] : []),
        s('circle', { class: `mm-goal${set ? ' set' : ''}${later.length > 1 ? ' far' : ''}`, cx: end.x, cy: end.y, r: 7 }));
    }
  }

  /** the footer: what the pointed spot takes, or why there is no way there; the plan. Small on the right, the turn time
   *  carried over (AD9) */
  function foot() {
    const shown = hover ?? plan;
    const parts = (p: Extract<MinimapPlan, { pts: Pos[] }>) => {
      const [m, ...rest] = p.words.split(' · '), last = rest.length > 1 && d?.ring !== null ? rest.pop()! : null;
      return [h('b', {}, m), ...rest.map((x) => ` · ${x}`), ...(last ? [' · ', h('b', { class: p.turns === 1 ? 'now' : 'far' }, last)] : []), ` · ${p.where}`];
    };
    say.replaceChildren(...(!d ? ['No map of where you are yet.'] : !shown ? [] : 'why' in shown ? [shown.why] : [...(shown === plan && !hover ? ['Planned: '] : []), ...parts(shown)]));
    go.hidden = !plan;
    carried.textContent = d && d.carried > 0 ? `+${r1(d.carried)} s carried over` : '';
    floorEl.textContent = d ? floorName(d.height) : '';
  }

  // MQ5 a: both sizes zoom through the same steps (metres across the view); the Map's fitted view is its widest
  const steps = () => [...CONFIG.MINIMAP_ZOOM_M, ...(fitW > CONFIG.MINIMAP_ZOOM_M[CONFIG.MINIMAP_ZOOM_M.length - 1] ? [fitW] : [])];
  const kOf = (m: number) => Math.max(0.2, Math.min(MAX_K, size().w / m / PX_PER_M));
  function setK(nk: number, c = { x: size().w / 2, y: size().h / 2 }) {
    off = { x: c.x - ((c.x - off.x) * nk) / k, y: c.y - ((c.y - off.y) * nk) / k }; // the point under c stays put
    k = nk;
    render();
  }
  function zoom(dir: number) {
    if (api.busy() || !d) return; // M-06
    const across = size().w / K(), st = steps();
    const i = st.reduce((b, x, j) => (Math.abs(x - across) < Math.abs(st[b] - across) ? j : b), 0);
    const nk = kOf(st[Math.max(0, Math.min(st.length - 1, i + dir))]);
    if (Math.abs(nk - k) > 1e-9) setK(nk);
  }
  /** you in the middle of the view */
  function onYou() { if (!d?.you) return; const { w, h: hh } = size(), y = px(d.you); off = { x: w / 2 - y.x, y: hh / 2 - y.y }; }
  function recentre() { if (api.busy() || !d) return; if (d.you) { onYou(); render(); } else fit(); }
  /** the Map's first view: the place (or the zones given) fitted, everything around it included (MAP-26) */
  function fit(only?: (z: MapZone) => boolean) {
    if (!d) return;
    const { w, h: hh } = size(), top = 60, bottom = 64, edge = 20, aw = w - 2 * edge, ah = hh - top - bottom;
    const zs = d.floor.filter((z) => z.rect && (!only || only(z))), zb = (zs.length ? zs : d.floor.filter((z) => z.rect)).map((z) => z.rect!);
    if (!zb.length) return;
    const ww = Math.max(...zb.map((q) => q.x + q.w / 2)) - Math.min(...zb.map((q) => q.x - q.w / 2)), dd = Math.max(...zb.map((q) => q.y + q.d / 2)) - Math.min(...zb.map((q) => q.y - q.d / 2));
    let kk = Math.max(0.2, Math.min(MAX_K, aw / (ww * PX_PER_M), ah / (dd * PX_PER_M)));
    let sc = sceneAt(kk);
    // the marks around the zones (labels outside, exit notes, titles) take room too: shrink until all of it fits
    for (let i = 0; i < 8; i++) {
      const bw = sc.bounds.x1 - sc.bounds.x0, bh = sc.bounds.y1 - sc.bounds.y0 + 34;
      if (bw <= aw && bh <= ah) break;
      kk = Math.max(0.2, kk * Math.min(aw / bw, ah / bh) * 0.96);
      sc = sceneAt(kk);
    }
    k = kk; fitW = w / K(); placed = true;
    const bw = sc.bounds.x1 - sc.bounds.x0, bh = sc.bounds.y1 - sc.bounds.y0 + 34;
    off = { x: edge + (aw - bw) / 2 - sc.bounds.x0, y: top + Math.max(0, (ah - bh) / 2) - sc.bounds.y0 };
    render();
  }
  function setPlan(p: Extract<MinimapPlan, { pts: Pos[] }>) {
    const same0 = plan && plan.zone === p.zone && plan.x === p.x && plan.y === p.y;
    plan = p;
    if (!same0) opts.onPlan(point(p));
    drawPath(); foot();
  }
  function clear() { if (!plan) return; plan = null; opts.onPlan(null); drawPath(); foot(); }

  // pointing, clicking, dragging the view, the wheel and keys; none of it while a turn runs (M-06)
  const svgAt = (e: MouseEvent) => { const r = svg.getBoundingClientRect(), { w, h: hh } = size(); return { x: ((e.clientX - r.left) * w) / (r.width || w), y: ((e.clientY - r.top) * hh) / (r.height || hh) }; };
  const metresAt = (e: MouseEvent) => { const a = svgAt(e); return { x: (a.x - off.x) / K(), y: -(a.y - off.y) / K() }; };
  function pointAt(e: MouseEvent): MinimapPlan | null {
    const st = api.state();
    if (!d || !st || api.busy()) return null;
    const q = metresAt(e), z = zoneAt(d.floor, q);
    return z ? planTo(st, d.km, z.id, q) : { why: 'You don’t know what is there.' };
  }
  /** MAP-85: the thing a mark stands for, as the deck targets it */
  const thingOf = (m: Element): MapThing | MapPeople => {
    const of = m.getAttribute('data-of')!, kind = m.getAttribute('data-thing');
    if (kind === 'wall') { const [x, y] = (m.getAttribute('data-at') ?? '').split(',').map(Number); return { kind, id: of, zone: m.getAttribute('data-zone')!, at: { x: x!, y: y! } }; }
    if (kind === 'people') { const names = m.getAttribute('data-names')!.split('|'); return { kind, who: of.split('|').map((id, i) => ({ id, name: names[i] })) }; }
    return kind === 'door' ? { kind, ends: of.split('|') } : kind === 'furniture' ? { kind, id: of, is: m.getAttribute('data-is')! } : { kind: kind === 'item' ? kind : 'person', id: of };
  };
  /** a mark that answers a click itself (MAP-62, MAP-63, MAP-85), before the ground under it plans a walk */
  function markAt(e: Event): boolean {
    const t = e.target as Element, x = t.closest?.('[data-exit]'), g = t.closest?.('[data-goto]'), a = t.closest?.('[data-area]'), th = t.closest?.('[data-thing]');
    if (th && !api.busy() && opts.onThing(thingOf(th), boxOf(th))) { thingOpen = true; return true; }
    if (x) { opts.onExit(x.getAttribute('data-exit-from')!, x.getAttribute('data-exit')!); return true; }
    if (g) { opts.onGoto(g.getAttribute('data-goto')!); return true; }
    if (a && opts.onArea && a.closest('.map-place-title')) { opts.onArea(a.getAttribute('data-area')!); return true; }
    return false;
  }
  const cardAt = (e: MouseEvent) => { if (!d) return; const z = zoneAt(d.floor, metresAt(e)); if (z) opts.onCard(z.id); };
  let drag: { x: number; y: number; off: Pos; moved: boolean } | null = null, press = 0, pressed = false, thingOpen = false;
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || api.busy()) return;
    drag = { x: e.clientX, y: e.clientY, off: { ...off }, moved: false };
    // MQ7 a: on touch, a long press opens the zone's card
    pressed = false; clearTimeout(press);
    if (e.pointerType === 'touch') press = window.setTimeout(() => { if (drag && !drag.moved) { pressed = true; cardAt(e); } }, CONFIG.MAP_LONG_PRESS_MS);
  });
  svg.addEventListener('pointermove', (e) => {
    if (api.busy()) return;
    if (drag && e.buttons & 1 && (drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4)) {
      const r = svg.getBoundingClientRect(), f = size().w / (r.width || size().w);
      if (!drag.moved) { clearTimeout(press); svg.classList.add('grabbing'); }
      drag.moved = true;
      off = { x: drag.off.x + (e.clientX - drag.x) * f, y: drag.off.y + (e.clientY - drag.y) * f };
      render();
      return;
    }
    hover = pointAt(e);
    svg.classList.toggle('no-way', !!hover && 'why' in hover);
    drawPath(); foot();
  });
  const up = () => { clearTimeout(press); svg.classList.remove('grabbing'); };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('pointerleave', () => { if (api.busy()) return; hover = null; svg.classList.remove('no-way'); drawPath(); foot(); });
  svg.addEventListener('click', (e) => {
    const dragged = drag?.moved; drag = null;
    if (dragged || pressed) return;
    thingOpen = false;
    if (markAt(e)) { e.stopPropagation(); return; }
    const p = pointAt(e);
    if (p && 'pts' in p) setPlan(p);
  });
  svg.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!api.busy()) cardAt(e); });
  svg.addEventListener('dblclick', (e) => { if ((e.target as Element).closest?.('[data-exit],[data-goto]') || thingOpen) return; const p = pointAt(e); if (p && 'pts' in p) { setPlan(p); opts.onWalk(point(p)); } });
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.sign(e.deltaY)); }, { passive: false });
  svg.addEventListener('keydown', (e) => {
    const t = e.target as Element;
    if ((e.key === 'Enter' || e.key === ' ') && t !== svg && markAt(e)) { e.preventDefault(); return; }
    if (e.key === 'Enter' && plan && !api.busy()) { e.preventDefault(); opts.onWalk(point(plan)); }
    else if (e.key === 'Escape' && plan) { e.preventDefault(); e.stopPropagation(); clear(); }
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (!d) return; if (!full) onYou(); render(); }).observe(svg);

  // MAP-51: in dev views (?fake= or ?mapcheck) the checker runs on every render, once the browser has laid it out
  const devCheck = typeof location !== 'undefined' && /[?&](fake|mapcheck)\b/.test(location.search);
  let checkTimer = 0;
  function scheduleCheck() {
    if (!devCheck) return;
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => requestAnimationFrame(() => {
      if (!d || !svg.isConnected) return;
      const ids = d.every.map((z) => z.id), have = new Set(ids), here = d.every.find((z) => z.here)?.id ?? ids[0];
      const pairs = d.every.flatMap((z) => z.links.filter((l) => have.has(l.to)).map((l) => [z.id, l.to] as [string, string]));
      const findings = [...checkMap(svg), ...checkReach(ids, pairs, here), ...checkStage(d.floor, d.places), ...(scene?.lost ?? []).map((id) => `MAP-32 exit ${id} found no room for its arrow and note`)];
      const tag = full ? 'map-check' : 'minimap-check';
      (window as unknown as Record<string, unknown>)[full ? '__mapFindings' : '__minimapFindings'] = { ...d.check, k, viewM: size().w / K(), findings };
      if (findings.length) for (const f of findings) console.warn(`[${tag}]`, f);
      else console.info(`[${tag}] 0 findings`);
    }), 120);
  }

  /** take what the view shows now; `refit` (the Map, a place newly shown) fits it again */
  function update(refit = false) {
    if (api.busy()) return; // M-06: nothing changes while a turn runs
    const nd = opts.data();
    d = nd;
    if (!d) { hover = null; if (plan) { plan = null; opts.onPlan(null); } render(); return; }
    const st = api.state()!;
    const atNow = d.you ? `${d.km.zoneId}:${d.you.x}:${d.you.y}` : '';
    if (full) { if (refit || !placed) { fitW = 0; requestAnimationFrame(() => fit((z) => !d!.focus || z.placeId === d!.focus || isIn(z))); } }
    else {
      if (!placed) { k = kOf(CONFIG.MINIMAP_VIEW_M); placed = true; }
      if (atNow !== lastAt) { lastAt = atNow; onYou(); hover = null; }
      // AD9: a ring wider than the view zooms out to fit it (across the view's short side), up to the widest step; BF91:
      // the dash ring, the wider, is the one fitted, so both show
      if (d.ring !== lastRing) {
        const { w, h: hh } = size(), need = (2.1 * (d.dash ?? d.ring ?? 0) * w) / Math.min(w, hh), across = w / K();
        lastRing = d.ring;
        if (need > across) { const st0 = CONFIG.MINIMAP_ZOOM_M; k = kOf(st0.find((x) => x >= need) ?? st0[st0.length - 1]); onYou(); }
      }
    }
    if (plan) {
      const again = planTo(st, d.km, plan.zone, plan);
      if (!('pts' in again)) { plan = null; opts.onPlan(null); }
      else if (again.metres !== plan.metres || again.turns !== plan.turns) { plan = again; opts.onPlan(point(again)); }
      else plan = again;
    }
    render();
  }
  /** a zone inside the focused place (the Map fits that place) */
  const isIn = (z: MapZone) => !!d?.places.find((p) => p.id === d!.focus)?.zones.some((x) => x.id === z.id);

  return { el, svg, update, render, fit, clear, planned: () => (plan ? point(plan) : null), scene: () => scene, centreOn: (q: Pos) => { const { w, h: hh } = size(), y = px(q); off = { x: w / 2 - y.x, y: hh / 2 - y.y }; render(); } };
}
export type PlanView = ReturnType<typeof planView>;
