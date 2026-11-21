// MAP-84 (MQ2 a): the map of a place, one component in two sizes. The minimap (Play's right column) and the Map pop-up are
// this same view: every mark, click and rule lives here once (MQ4 a), only the frame around it differs (the pop-up adds
// crumbs, key, places list, cards and the height slider). Code lays every mark out (planScene, rpg-map), this draws it
// to scale from what the character knows, and dev views check it (MAP-51). A click on the ground plans a walk to that
// exact point (MAP-81, AD16); a double-click, Enter or Just go walks; a right-click, or a long press on touch, opens the
// zone's card (MAP-64, MQ3, MQ7 a). In a fight the rings show how far a move slot walks and a dash runs (AD9, BF91).
// Nothing changes while a turn runs (M-06).
import type { GameApi } from '../types';
import { boxOf, h, plural } from './kit';
import { CONFIG } from '../config';
import type { KnownMap, MapZone } from './mapData';
import { PX_PER_M, TEXT, WHO_ICON_SHARE, checkReach, checkStage, nameFit, planScene, roughMeasure, type Box, type Measure, type Scene, type TextKind } from './mapPlan';
import { checkMap } from './mapCheck';
import { doorGlyph, fogClip, fogMask, iconMark, keyTool, planKeyRows, floorMarks, floorName, pin, wayBadge } from './map';
import { furnIcon } from './furnitureIcons';
import { metresText, planTo, splitAt, zoneAt, type MinimapPlan, type MinimapPoint } from './minimap';
import { areaOf } from '../plan/geom';
import { distText } from '../views';
import { cap, r1 } from '../words';
import type { Pos } from '../engine/position';
import type { MapThing } from './deck';

export type PlanSize = 'mini' | 'full';
type Places = Parameters<typeof planScene>[0]['places'];
/** what the view draws, taken at update() and kept while a turn runs (M-06) */
export type PlanData = {
  km: KnownMap; every: MapZone[]; floor: MapZone[]; height: number; places: Places;
  /** MAP-68: the people this map shows on this floor (KnownMap.people on it) */
  people: KnownMap['people'];
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
  onThing(t: MapThing, anchor: ReturnType<typeof boxOf>): boolean;
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
  /** the view: the zoom (k, the layout's scale) and where the layout's origin sits in the svg, in pixels; org: the point
   *  (metres) the layout draws at its origin (D-1558), kept near the view so screen numbers stay small kilometres out */
  let k = 1, off = { x: 0, y: 0 }, org: Pos = { x: 0, y: 0 }, placed = false, fitW = 0;
  let lastAt = '', lastRing: number | null = null;
  let hover: MinimapPlan | null = null, plan: Extract<MinimapPlan, { pts: Pos[] }> | null = null;

  // SD4: how to use it is the map's tip and name, not a line under it
  const svg = s('svg', { class: `mm-svg${full ? ' map-svg' : ''}`, tabindex: 0, role: 'group', 'aria-label': `${full ? 'Map' : 'Minimap'}. ${HINT}` }) as SVGSVGElement;
  const fogId = `pv-fog-${++fogIds}`;
  const world = s('g'), gFog = s('defs'), gAreas = s('g'), gFaces = s('g', { class: 'map-faces', 'aria-hidden': 'true' }), gZones = s('g', { class: 'map-zones', 'clip-path': `url(#${fogId})`, mask: `url(#${fogId}-now)` }), gNames = s('g', { class: 'map-names', 'aria-hidden': 'true' });
  const gScale = s('g', { class: 'map-scale', 'aria-hidden': 'true' }), gRing = s('g'), gMarks = s('g', { class: 'map-marks' }), gPath = s('g'), gTokens = s('g');
  world.append(gFog, gAreas, gZones, gFaces, gNames, gRing, gMarks, gPath, gTokens);
  svg.append(s('defs', {},
    s('marker', { id: `${fogId}-arrow`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 10 5 0 10z', class: 'map-arrowhead' }))),
  s('title', {}, HINT), world, gScale);
  const floorEl = h('span', { class: 'mm-floor' });
  const tool = (label: string, title: string, on: () => void, open?: string) => h('button', { type: 'button', 'data-tip': title, 'aria-label': title, 'data-open': open, onclick: on }, label);
  const key = full ? keyTool('mm-key-btn') : null; // MAP-30: the Map's key, beside its zoom buttons
  // MAP-87 (TD2 a): the Map's 3D button; the walls rise out of the plan and sink back (the minimap stays flat)
  let d3 = false;
  const d3btn = full ? tool('3D', 'Walls standing', () => {
    d3 = !d3; d3btn!.setAttribute('aria-pressed', String(d3));
    if (!d3) { svg.classList.remove('d3'); gFaces.addEventListener('transitionend', () => d3 || gFaces.replaceChildren(), { once: true }); return; } // they sink, then go
    if (!gFaces.childElementCount) render(); // still sinking: they rise again from where they are (M-73)
    requestAnimationFrame(() => svg.classList.add('d3'));
  }) : null;
  d3btn?.setAttribute('aria-pressed', 'false');
  const say = h('span', { class: 'mm-say' }), carried = h('span', { class: 'mm-carry' });
  const go = h('button', { type: 'button', class: 'mm-go', hidden: true, onclick: () => plan && !api.busy() && opts.onWalk(point(plan)) }, 'Just go');
  const el = h('section', { class: `mm${full ? ' mm-full' : ''}`, 'aria-label': full ? 'Map of this place' : 'Minimap' },
    h('div', { class: 'mm-head' }, floorEl,
      ...(key ? [key.list] : []), h('span', { class: 'mm-tools' }, ...(key ? [key.btn] : []), tool('+', 'Zoom in', () => zoom(-1)), tool('−', 'Zoom out', () => zoom(1)), tool('◎', full ? 'Find me' : 'Back to you', recentre),
        full ? tool('⤢', 'Show the whole map', () => opts.onExpand()) : tool('⤢', 'Open the full map', () => opts.onExpand(), 'map'), ...(d3btn ? [d3btn] : []))),
    svg, h('div', { class: 'mm-foot' }, say, go, carried));

  // each mark's <title> is its hover text, shown as the game's tip (mountTip)

  const point = (p: MinimapPoint): MinimapPoint => ({ zone: p.zone, x: p.x, y: p.y, metres: p.metres, seconds: p.seconds, turns: p.turns, label: p.label });
  const size = () => ({ w: svg.clientWidth || 420, h: svg.clientHeight || 360 });
  /** screen pixels per metre */
  const K = () => k * PX_PER_M;
  const px = (q: Pos) => ({ x: (q.x - org.x) * K(), y: -(q.y - org.y) * K() });
  /** D-1558: the view's middle as the origin, once the view has moved this many pixels from it (float precision) */
  const ORIGIN_PX = 20000;
  function reorigin() {
    const { w, h: hh } = size(), c = { x: org.x + (w / 2 - off.x) / K(), y: org.y - (hh / 2 - off.y) / K() };
    if (Math.hypot(c.x - org.x, c.y - org.y) * K() < ORIGIN_PX) return;
    const n = { x: Math.round(c.x), y: Math.round(c.y) };
    off = { x: off.x + (n.x - org.x) * K(), y: off.y - (n.y - org.y) * K() };
    org = n;
  }

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
  // D-1558: the scene is laid out once per zoom for the data taken at update(); panning only redraws it
  const scenes = new Map<string, Scene>();
  let scenesOf: PlanData | null = null;
  const sceneAt = (kk: number) => {
    if (scenesOf !== d) { scenes.clear(); scenesOf = d; }
    const key = `${kk}|${org.x}|${org.y}`;
    let sc = scenes.get(key);
    if (!sc) scenes.set(key, (sc = planScene({ zones: d!.floor, every: d!.every, places: d!.places, people: d!.people, k: kk, measure, awayName: d!.awayName, youWidthM: d!.km.youWidthM, o: org })));
    return sc;
  };
  // names are sized from measured text: once the map's own font has loaded, lay the scene out again
  document.fonts?.ready.then(() => { scenes.clear(); if (d) render(); });

  /** a zone to scale: its floor at its real size, each side drawn as its edge kind; no zone state (MAP-33): the fog's
   *  two tones say what is in sight now, and the zone you stand in has no outline, even when its card is open */
  function planZone(z: MapZone, b: Box, c: Box) {
    const cls = ['map-tile', 'plan', z.outdoor ? 'outdoor' : 'indoor', z.id === d?.heading ? 'heading' : '', z.id === d?.selected && !z.here ? 'selected' : '', z.light === 'dark' ? 'dark' : ''].filter(Boolean).join(' ');
    const m2 = Math.round(z.outline?.length ? areaOf(z.outline) : z.rect!.w * z.rect!.d);
    const w = b.x1 - b.x0, hh = b.y1 - b.y0;
    // the drawn floor sits a hair inside its walls, so zones that share a wall never measure as overlapping (MAP-11)
    const sc = z.rect!.w ? w / z.rect!.w : PX_PER_M, fm = floorMarks(z, sc, -org.x * sc, org.y * sc), tag = { 'data-role': 'zone', 'data-id': z.id, 'data-parent': z.placeId };
    const box = (cls2: string, extra = {}) => fm.floor ? s('polygon', { points: fm.floor, class: cls2, ...extra }) : s('rect', { x: b.x0 + 0.5, y: b.y0 + 0.5, width: Math.max(0, w - 1), height: Math.max(0, hh - 1), class: cls2, ...extra });
    // MAP-50: nothing tagged past the edge: a zone partly in view is tagged by the part in view, drawn whole
    const cut = !same(c, b), g = s('g', { class: cls, 'data-zone': z.id, ...(z.here ? { 'aria-current': 'location' } : {}), 'aria-label': `${z.name}, ${m2} m²${z.id === d?.heading ? ', you are heading here' : ''}` }, box('map-tile-box', cut ? {} : tag),
      ...(cut ? [s('rect', { x: c.x0 + 0.5, y: c.y0 + 0.5, width: Math.max(0, c.x1 - c.x0 - 1), height: Math.max(0, c.y1 - c.y0 - 1), class: 'mm-tag', ...tag })] : []));
    g.append(...fm.walls, s('title', {}, `${cap(z.name)}: ${Math.round(z.rect!.w)} × ${Math.round(z.rect!.d)} m`));
    return g;
  }
  /** MAP-87 (TD1 a): each wall standing up from its line, see-through, leaning CONFIG.MAP_3D_LEAN and rising CONFIG.MAP_3D_RISE
   *  of its height to the screen's up, each door, gap or window a hole to scale; only over ground seen, faded where only
   *  remembered (MAP-16, MAP-33). A wall two titles share is drawn once, the far ones first */
  function wallFaces(zones: MapZone[]): SVGElement[] {
    const done = new Set<string>(), out: { y: number; g: SVGElement }[] = [];
    const v = { x: CONFIG.MAP_3D_LEAN * K(), y: -CONFIG.MAP_3D_RISE * K() };
    for (const z of zones) for (const w of z.walls ?? []) {
      const top = w.topM ?? 0, L = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
      const id = [w.a, w.b].map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).sort().join('|');
      if (!w.id || top <= 0 || L < 0.01 || done.has(id)) continue;
      done.add(id);
      const u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L }, a = px(w.a);
      // the seen and in-sight stretches of its foot (MAP-16, MAP-33), as distances along it
      const along = (rs: { x0: number; x1: number; y0: number; y1: number }[]) => rs.flatMap((r) => {
        let t0 = 0, t1 = L;
        for (const [p0, d0, lo, hi] of [[w.a.x, u.x, r.x0, r.x1], [w.a.y, u.y, r.y0, r.y1]]) {
          if (Math.abs(d0) < 1e-9) { if (p0 < lo - 0.05 || p0 > hi + 0.05) return []; continue; }
          const q0 = (lo - 0.05 - p0) / d0, q1 = (hi + 0.05 - p0) / d0;
          t0 = Math.max(t0, Math.min(q0, q1)); t1 = Math.min(t1, Math.max(q0, q1));
        }
        return t1 > t0 ? [[t0, t1]] : [];
      });
      const seen = z.seen ? along(z.seen) : [[0, L]], sight = z.sight ? along(z.sight) : seen;
      const cuts = [...new Set([0, L, ...seen.flat(), ...sight.flat()])].sort((p, q) => p - q);
      const holes = z.links.filter((l) => l.at && l.widthM && !l.stairs && Math.abs((l.at.x - w.a.x) * u.y - (l.at.y - w.a.y) * u.x) < 0.3)
        .map((l) => { const c = (l.at!.x - w.a.x) * u.x + (l.at!.y - w.a.y) * u.y; return { s0: c - l.widthM! / 2, s1: c + l.widthM! / 2, h0: l.sillM ?? 0, h1: Math.min(top, (l.sillM ?? 0) + (l.heightM ?? top)) }; });
      // the seen stretches, each run of one tone joined, so a face has no seam at every fog square
      const parts: { s0: number; s1: number; now: boolean }[] = [];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const m = (cuts[i] + cuts[i + 1]) / 2, inn = (rs: number[][]) => rs.some(([p, q]) => m >= p && m <= q), last = parts[parts.length - 1];
        if (cuts[i + 1] - cuts[i] < 0.01 || !inn(seen)) continue;
        if (last && Math.abs(last.s1 - cuts[i]) < 0.01 && last.now === inn(sight)) last.s1 = cuts[i + 1]; else parts.push({ s0: cuts[i], s1: cuts[i + 1], now: inn(sight) });
      }
      for (const { s0, s1, now } of parts) {
        // the face as rectangles in metres along it and up it, around each hole
        const rects: number[][] = [], hs = holes.filter((x) => x.s1 > s0 && x.s0 < s1).sort((p, q) => p.s0 - q.s0);
        let at = s0;
        for (const x of hs) {
          const h0 = Math.max(s0, x.s0), h1 = Math.min(s1, x.s1);
          if (h0 > at) rects.push([at, h0, 0, top]);
          if (x.h0 > 0) rects.push([h0, h1, 0, x.h0]);
          if (x.h1 < top) rects.push([h0, h1, x.h1, top]);
          at = Math.max(at, h1);
        }
        if (at < s1) rects.push([at, s1, 0, top]);
        const rise = s('g', { class: 'rise' }, ...rects.map(([x0, x1, y0, y1]) => s('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 })),
          s('line', { class: 'top', x1: s0, y1: top, x2: s1, y2: top }));
        out.push({ y: Math.max(a.y, px(w.b).y), g: s('g', { class: `map-face ${w.cls}${now ? '' : ' faded'}`, transform: `matrix(${u.x * K()} ${-u.y * K()} ${v.x} ${v.y} ${a.x} ${a.y})` }, rise) });
      }
    }
    return out.sort((p, q) => p.y - q.y).map((x) => x.g);
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
    for (const g of [gAreas, gZones, gFaces, gNames, gRing, gMarks, gTokens]) g.replaceChildren();
    gFog.replaceChildren();
    if (!d) { scene = null; gPath.replaceChildren(); foot(); return; }
    const { w, h: hh } = size();
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    reorigin();
    world.setAttribute('transform', `translate(${off.x} ${off.y})`);
    const vb: Box = { x0: -off.x, y0: -off.y, x1: w - off.x, y1: hh - off.y }, inView: Box = { x0: vb.x0 + 1, y0: vb.y0 + 1, x1: vb.x1 - 1, y1: vb.y1 - 1 };
    const sc = (scene = sceneAt(k));
    gFog.append(fogClip(fogId, sc.zones.map((x) => x.z), K(), org), fogMask(`${fogId}-now`, sc.zones.map((x) => x.z), K(), org)); // BG-313: only ground the character has seen; MAP-33: in sight now full, the rest faded
    for (const p of sc.places) {
      const c = clip(p.box, vb);
      if (!c) continue;
      const cut = !same(c, p.box), r = (q: Box, extra = {}) => s('rect', { x: q.x0, y: q.y0, width: q.x1 - q.x0, height: q.y1 - q.y0, ...extra });
      gAreas.append(s('g', { class: `map-area real${p.id === d.focus ? ' on' : ''}`, 'data-area': p.id, 'aria-label': `${p.name}: a place on this map` },
        s('path', { d: p.outline, ...(cut ? {} : { 'data-role': 'place', 'data-id': p.id }) }), ...(cut ? [r(c, { class: 'mm-tag', 'data-role': 'place', 'data-id': p.id })] : [])));
    }
    if (d3) gFaces.append(...wallFaces(sc.zones.filter((x) => clip(x.box, vb)).map((x) => x.z)));
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
      const tag = { 'data-role': 'icon', 'data-id': dd.id, role: 'img', 'aria-label': dd.title, 'data-thing': 'door', 'data-of': dd.zones.join('|') };
      // MAP-14 (RM28 a): the door to scale in its wall, its barrier's badge on it
      gMarks.append(s('g', { class: `map-door ${dd.kind}`, ...tag }, ...doorGlyph(dd.cx, dd.cy, dd.kind, dd.dir, dd.len, dd.thick, dd.wall),
        ...(dd.badge && dd.way?.shut ? [s('g', { class: `map-way ${dd.way.shut}${dd.way.key ? ' key' : ''}` }, wayBadge(dd.badge.cx, dd.badge.cy, dd.badge.r, dd.way.shut))] : []), s('title', {}, dd.title)));
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
    let you: SVGElement | undefined;
    for (const t of sc.tokens) {
      if (!within(t, inView)) continue;
      if (t.you) { const g = pin(t.cx, t.cy, d.youTitle ?? 'You are here', d.facing, t.r); g.setAttribute('data-role', 'token'); g.setAttribute('data-id', 'you'); you = g; continue; }
      const who = t.who!, c = t.cap, tok = { 'data-role': 'token', 'data-id': t.id };
      // BG-324: the disc (GSM-193: or the body's capsule) alone is the token the checker measures, and what a click lands on
      // (OM4b a); its icon (MAP-69) sits inside it
      const shape = c ? s('rect', { x: t.cx - c.len / 2, y: t.cy - c.wide / 2, width: c.len, height: c.wide, rx: Math.min(c.len, c.wide) / 2, transform: `rotate(${c.deg} ${t.cx} ${t.cy})`, ...tok })
        : s('circle', { cx: t.cx, cy: t.cy, r: t.r, ...tok });
      // MAP-69 (OM4b a): the icon scales with the body, fitted inside its narrower side however it is turned; too small, left off
      const turn = c ? Math.abs(Math.cos((c.deg * Math.PI) / 180)) + Math.abs(Math.sin((c.deg * Math.PI) / 180)) : 1;
      const iconPx = ((c ? Math.min(c.len, c.wide) / turn : 2 * t.r)) * WHO_ICON_SHARE;
      const g = s('g', { class: `map-who plan-who${who.now && !who.lastAt ? '' : ' last'}${who.at ? ' at' : ''}`, ...(t.zoneId ? { 'data-zone': t.zoneId } : {}), 'data-thing': 'person', 'data-of': who.id, tabindex: 0, role: 'button', 'aria-label': `${t.title}: what to do` },
        ...(t.rings ?? []).map((q) => s('circle', { class: 'map-who-ring', cx: q.cx, cy: q.cy, r: q.r })),
        shape, ...(iconPx >= CONFIG.MAP_WHO_ICON_MIN_PX ? [iconMark(who.icon, t.cx, t.cy, iconPx, 'map-who-icon')] : []), // RX2 b
        s('text', { x: t.x1 + 4, y: t.cy + 4, class: 'map-who-label' }, who.name), s('title', {}, t.title));
      gTokens.append(g);
    }
    if (you) gTokens.append(you); // RM33: your pin above every other mark
    // MAP-10, OM7 a: the scale bar, fixed at the view's bottom left: the longest round length (1, 2.5 or 5 of a power of ten)
    // up to a fifth of the view's width, and its paces
    const span = w / 5 / K(), p10 = 10 ** Math.floor(Math.log10(span)), m = p10 * [5, 2.5, 1].find((f) => f * p10 <= span)!;
    const len = m * K(), bx = 12, by = hh - 14;
    gScale.replaceChildren(s('line', { x1: bx, y1: by, x2: bx + len, y2: by }), s('line', { x1: bx, y1: by - 5, x2: bx, y2: by + 5 }),
      s('line', { x1: bx + len, y1: by - 5, x2: bx + len, y2: by + 5 }), s('text', { x: bx + len + 8, y: by + 4 }, m < 1000 ? `${metresText(m)} · ${plural(Math.round(m / CONFIG.PACE_M), 'pace')}` : distText(m)));
    drawPath();
    foot();
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

  // MQ5 a, OM7 a: both sizes zoom through the same steps (metres across the view), and the Map's fitted width among them
  const steps = () => [...CONFIG.MINIMAP_ZOOM_M, ...(fitW ? [fitW] : [])].sort((a, b) => a - b);
  const kOf = (m: number) => size().w / m / PX_PER_M;
  function setK(nk: number, c = { x: size().w / 2, y: size().h / 2 }) {
    off = { x: c.x - ((c.x - off.x) * nk) / k, y: c.y - ((c.y - off.y) * nk) / k }; // the point under c stays put
    k = nk;
    render();
  }
  function zoom(dir: number) {
    if (api.busy() || !d) return; // M-06
    // the next step wider (dir 1) or closer (dir -1) than the view now
    const across = size().w / K(), st = steps(), to = dir > 0 ? st.find((x) => x > across * 1.01) : [...st].reverse().find((x) => x < across * 0.99);
    if (to) setK(kOf(to));
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
    org = { x: Math.round((Math.max(...zb.map((q) => q.x + q.w / 2)) + Math.min(...zb.map((q) => q.x - q.w / 2))) / 2), y: Math.round((Math.max(...zb.map((q) => q.y + q.d / 2)) + Math.min(...zb.map((q) => q.y - q.d / 2))) / 2) };
    // no closer than the closest zoom step (OM7 a)
    const most = kOf(CONFIG.MINIMAP_ZOOM_M[0]);
    let kk = Math.min(most, aw / (ww * PX_PER_M), ah / (dd * PX_PER_M));
    let sc = sceneAt(kk);
    // the marks around the zones (labels outside, exit notes, titles) take room too: shrink until all of it fits
    for (let i = 0; i < 8; i++) {
      const bw = sc.bounds.x1 - sc.bounds.x0, bh = sc.bounds.y1 - sc.bounds.y0 + 34;
      if (bw <= aw && bh <= ah) break;
      kk *= Math.min(aw / bw, ah / bh) * 0.96;
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
  const metresAt = (e: MouseEvent) => { const a = svgAt(e); return { x: org.x + (a.x - off.x) / K(), y: org.y - (a.y - off.y) / K() }; };
  function pointAt(e: MouseEvent): MinimapPlan | null {
    const st = api.state();
    if (!d || !st || api.busy()) return null;
    const q = metresAt(e), z = zoneAt(d.floor, q);
    return z ? planTo(st, d.km, z.id, q) : { why: 'You don’t know what is there.' };
  }
  /** MAP-85: the thing a mark stands for, as the deck targets it */
  const thingOf = (m: Element): MapThing => {
    const of = m.getAttribute('data-of')!, kind = m.getAttribute('data-thing');
    if (kind === 'wall') { const [x, y] = (m.getAttribute('data-at') ?? '').split(',').map(Number); return { kind, id: of, zone: m.getAttribute('data-zone')!, at: { x: x!, y: y! } }; }
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
