// The play screen's minimap (AD8–AD16): the floor you stand on, centred on you and drawn to scale from what the character
// knows (knownMap, as the full Map), its marks laid out by the full Map's own code (planScene: MAP-23, MAP-25, MAP-31).
// Point anywhere known to see the walk there through the doorways as the engine walks it (walkRoute) and how long it
// takes; a click plans a move to that exact point (MoveSpot.at, AD16), a double-click, Enter or Just go walks at once, Esc
// clears. In a fight a ring shows how far one move slot walks this turn, carried time included (AD9). Only colour and
// opacity change, on hover (M-70); nothing changes while a turn runs (M-06).
import type { GameApi, GameState } from '../types';
import { h } from './kit';
import { CONFIG } from '../config';
import { knownMap, rootPlace, type KnownMap, type MapZone } from './mapData';
import { NAME_PX, PX_PER_M, TEXT, checkReach, planScene, wrap, type Box, type Measure } from './mapPlan';
import { checkMap } from './mapCheck';
import { doorGlyph, floorName, wayGlyph, wayWords, whoInitial } from './map';
import { furnIcon } from './furnitureIcons';
import { moveSpeed, slotMetres } from '../engine/speed';
import { M_EPS, spotPoint, walkRoute, type Pos } from '../engine/position';
import { shortestPath } from '../engine/relations';
import { distText } from '../views';
import { cap, r1, theName } from '../words';
import { EK } from '../library/tableIds';

export type MinimapPoint = { zone: string; x: number; y: number; metres: number; seconds: number; turns: number; label: string };
/** a point's plan: the walk there (its points, in metres) and how it reads on the path; or why there is no way there */
export type MinimapPlan = (MinimapPoint & { pts: Pos[]; words: string; where: string }) | { why: string };

/** TP4: the move seconds carried into this turn (noteCarry keeps only what is still good) */
export const carriedMoveS = (s: GameState): number => (s.player.carry ?? []).reduce((n, c) => n + c.move, 0);
/** AD9: metres one move slot walks this turn, carried time included; null outside a fight (no ring) */
export const ringMetres = (s: GameState): number | null => (s.mode === 'tactical' ? slotMetres(s, s.player, 'move', CONFIG.FIGHT_TURN_S + carriedMoveS(s)) : null);
/** metres as the minimap says them: to a tenth under 10 m ("6.4 m"), whole above ("22 m") */
export const metresText = (m: number): string => (m < 9.95 ? `${r1(m)} m` : distText(m));
const secondsText = (t: number) => (t < 90 ? `${Math.round(t)} s` : `${Math.round(t / 60)} min`);

/** AD16: the plan for a move to point `at` (metres) in known zone `zoneId`: where it ends (spotPoint: a step inside the
 *  walls), the walk there as the engine walks it, its metres, walking seconds and turns (one move slot a turn), and how
 *  it reads; or why the player knows no way there */
export function planTo(s: GameState, m: KnownMap, zoneId: string, at: Pos): MinimapPlan {
  const p = s.player, known = new Map(m.places.flatMap((x) => x.zones).map((z) => [z.id, z]));
  const z = known.get(zoneId), sp = z?.rect && p.pos ? spotPoint(s, zoneId, { at }, p) : null;
  if (!z || !sp) return { why: 'You don’t know what is there.' };
  if (zoneId !== p.zone && !shortestPath(s, p.zone, zoneId, false, p)) {
    // every way there is shut to you, as you know it (MapLink.way): name the first one on the way
    const plain = shortestPath(s, p.zone, zoneId) ?? [];
    const shut = plain.map((id, i) => known.get(i ? plain[i - 1] : p.zone)?.links.find((l) => l.to === id)).find((l) => l?.way?.shut);
    return { why: shut ? `No way there you can take: ${shut.label} (${wayWords(shut.way!)}).` : 'You know no way there.' };
  }
  const r = walkRoute(s, p, { zone: zoneId, pos: sp.pos }, p);
  if (!r || r.path.some((id) => !known.has(id))) return { why: 'You know no way there.' }; // MAP-40: never a way through what you don't know
  if (r.metres < CONFIG.MINIMAP_MIN_M) return { why: 'You are standing there.' };
  const walk = moveSpeed(s, p).walk;
  if (walk <= 0) return { why: 'You can’t walk now.' };
  const ring = ringMetres(s), per = slotMetres(s, p, 'move'), seconds = r.metres / walk, M = metresText(r.metres);
  const turns = ring === null || r.metres <= ring + M_EPS ? 1 : 1 + Math.ceil((r.metres - ring - M_EPS) / per);
  const words = ring === null ? `${M} · ${secondsText(seconds)} walking` : turns === 1 ? `${M} · ${secondsText(seconds)} walking · this turn` : `${M} · ${turns} turns · keeps walking by itself`;
  return { zone: zoneId, x: sp.pos.x, y: sp.pos.y, metres: r.metres, seconds, turns, label: `${theName(z.name)}, ${M}`, pts: r.pts, words, where: theName(z.name) };
}

/** a path cut where `m` metres along it run out: the part walked this turn, and the rest (empty when it all fits) */
export function splitAt(pts: Pos[], m: number): [Pos[], Pos[]] {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l > m + M_EPS) { const c = { x: a.x + ((b.x - a.x) * m) / l, y: a.y + ((b.y - a.y) * m) / l }; return [[...pts.slice(0, i), c], [c, ...pts.slice(i)]]; }
    m -= l;
  }
  return [pts, []];
}

/** the known zone of these at a point (metres): the smallest that holds it (MAP-11: zones nest, never overlap) */
export function zoneAt(zones: MapZone[], q: Pos): MapZone | undefined {
  const hits = zones.filter((z) => z.rect && Math.abs(q.x - z.rect.x) <= z.rect.w / 2 && Math.abs(q.y - z.rect.y) <= z.rect.d / 2);
  return hits.sort((a, b) => a.rect!.w * a.rect!.d - b.rect!.w * b.rect!.d)[0];
}

const SVGNS = 'http://www.w3.org/2000/svg';
const s = (tag: string, attrs: Record<string, string | number> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};
/** a zone name's largest letters on the minimap (MAP-20 lets them grow to NAME_PX.max; the mock-up keeps them small) */
const NAME_MAX = 15;
/** room a name keeps from its zone's walls (MAP-20: 6 px, plus the hair the floor sits inside), and its letters' dark edge */
const PAD = 7, NAME_EDGE = 3;
/** CSS class of each edge kind's line, as the full Map draws it */
const EDGE_CLASS: Record<string, string> = { [EK.wall]: 'wall', [EK.open]: 'open', [EK.low]: 'low', [EK.window]: 'window' };
const HINT = 'Point anywhere you know to see the way and how long it takes. Click to plan a move; double-click to walk there now.';
const clip = (a: Box, b: Box): Box | null => {
  const c = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return c.x1 - c.x0 > 1 && c.y1 - c.y0 > 1 ? c : null;
};
const within = (a: Box, b: Box) => a.x0 >= b.x0 && a.y0 >= b.y0 && a.x1 <= b.x1 && a.y1 <= b.y1;

export function minimapPanel(api: GameApi, opts: {
  onPlan(p: MinimapPoint | null): void;
  onWalk(p: MinimapPoint): void;
  onPerson(actorId: string, anchor: DOMRect): void;
  onOpenMap(): void;
}): { el: HTMLElement; update(): void; clear(): void; planned(): MinimapPoint | null } {
  const steps = CONFIG.MINIMAP_ZOOM_M, widest = steps[steps.length - 1];
  let viewM = CONFIG.MINIMAP_VIEW_M, pan = { x: 0, y: 0 }; // pan: svg pixels the view is dragged off you
  // M-06: what the minimap shows is taken at update() and kept while a turn runs; the live state is read only between turns
  type Snap = { km: KnownMap; floor: MapZone[]; every: MapZone[]; height: number; you: Pos; facing?: [number, number]; ring: number | null; carried: number };
  let snap: Snap | null = null, lastAt = '', lastRing: number | null = null, face = '';
  let hover: MinimapPlan | null = null, plan: Extract<MinimapPlan, { pts: Pos[] }> | null = null;

  const svg = s('svg', { class: 'mm-svg', tabindex: 0, role: 'group', 'aria-label': 'Minimap: click a spot to plan a move there, double-click to walk there now' }) as SVGSVGElement;
  const world = s('g'), gZones = s('g'), gNames = s('g', { 'aria-hidden': 'true' }), gRing = s('g'), gMarks = s('g'), gPath = s('g'), gTokens = s('g');
  world.append(gZones, gNames, gRing, gMarks, gPath, gTokens);
  svg.append(world);
  const floorEl = h('span', { class: 'mm-floor' });
  const tool = (label: string, title: string, on: () => void) => h('button', { type: 'button', title, 'aria-label': title, onclick: on }, label);
  const say = h('span', { class: 'mm-say' }), carried = h('span', { class: 'mm-carry' });
  const go = h('button', { type: 'button', class: 'mm-go', hidden: true, onclick: () => plan && !api.busy() && opts.onWalk(point(plan)) }, 'Just go');
  const el = h('section', { class: 'mm', 'aria-label': 'Minimap' },
    h('div', { class: 'mm-head' }, h('b', {}, 'Minimap'), floorEl,
      h('span', { class: 'mm-tools' }, tool('+', 'Zoom in', () => zoom(-1)), tool('−', 'Zoom out', () => zoom(1)), tool('◎', 'Back to you', recentre), tool('⤢', 'Open the full map', () => opts.onOpenMap()))),
    svg, h('div', { class: 'mm-foot' }, say, go, carried));

  const point = (p: MinimapPoint): MinimapPoint => ({ zone: p.zone, x: p.x, y: p.y, metres: p.metres, seconds: p.seconds, turns: p.turns, label: p.label });
  const size = () => ({ w: svg.clientWidth || 420, h: svg.clientHeight || 360 });
  /** screen pixels per metre, and where metre (0, 0) sits in the svg (y up in metres, down on screen) */
  const frame = () => {
    const { w, h: hh } = size(), K = w / viewM, you = snap!.you;
    return { K, k: K / PX_PER_M, o: { x: w / 2 - you.x * K + pan.x, y: hh / 2 + you.y * K + pan.y }, w, h: hh };
  };
  const px = (q: Pos, K: number) => ({ x: q.x * K, y: -q.y * K });

  // a name's letters measured in the browser (MAP-51: the checker measures the real text too)
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const measure: Measure = (t, kind) => {
    if (!ctx) return t.length * TEXT[kind].size * 0.6;
    ctx.font = `${TEXT[kind].weight} ${TEXT[kind].size}px ${face || 'sans-serif'}`;
    return ctx.measureText(t).width;
  };
  /** MAP-20/MAP-22: a zone's name, centred in the part of it in view, as large as fits up to NAME_MAX; null when even the
   *  smallest letters don't fit (the name is then in its tooltip only) */
  function nameIn(text: string, b: Box): { lines: string[]; size: number; line: number } | null {
    const rw = b.x1 - b.x0 - 2 * PAD - NAME_EDGE, rh = b.y1 - b.y0 - 2 * PAD - NAME_EDGE;
    if (rw <= 0 || rh <= 0) return null;
    for (let size = NAME_MAX; size >= NAME_PX.min; size -= 0.5) {
      const m: Measure = (t, kd) => (measure(t, kd) * size) / TEXT.label.size, line = size * 1.2;
      const lines = wrap(text, 'label', rw + 2 * TEXT.label.pad, 3, m);
      if (lines && lines.length * line - line + size * 1.3 <= rh) return { lines, size, line };
    }
    return null;
  }

  function render() {
    for (const g of [gZones, gNames, gRing, gMarks, gTokens]) g.replaceChildren();
    if (!snap) { gPath.replaceChildren(); foot(); return; }
    const { K, k, o, w, h: hh } = frame();
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    world.setAttribute('transform', `translate(${o.x} ${o.y})`);
    const vb: Box = { x0: -o.x, y0: -o.y, x1: w - o.x, y1: hh - o.y }, inView: Box = { x0: vb.x0 + 1, y0: vb.y0 + 1, x1: vb.x1 - 1, y1: vb.y1 - 1 };
    face = getComputedStyle(svg).getPropertyValue('--font-round').trim();
    const scene = planScene({ zones: snap.floor, every: snap.every, places: [], k, measure, visits: new Set(snap.km.visited), awayName: () => undefined });
    // zones (MAP-33/34): the floor in view is the tagged zone (MAP-50: nothing tagged past the edge); its walls run on
    // past the edge, each side drawn as its edge kind
    for (const x of scene.zones) {
      const b = x.box, c = clip(b, vb), z = x.z;
      if (!c) continue;
      const g = s('g', { class: `mm-zone ${x.state} ${z.outdoor ? 'outdoor' : 'indoor'}${z.inView ? '' : ' remembered'}` },
        s('rect', { class: 'mm-ground', x: c.x0 + 0.5, y: c.y0 + 0.5, width: c.x1 - c.x0 - 1, height: c.y1 - c.y0 - 1, 'data-role': 'zone', 'data-id': z.id, 'data-parent': z.placeId }));
      const sides: Record<string, [number, number, number, number]> = { n: [b.x0, b.y0, b.x1, b.y0], s: [b.x0, b.y1, b.x1, b.y1], w: [b.x0, b.y0, b.x0, b.y1], e: [b.x1, b.y0, b.x1, b.y1] };
      for (const [side, [x1, y1, x2, y2]] of Object.entries(sides)) {
        const kind = (z.edges as Record<string, string> | undefined)?.[side] ?? (z.outdoor ? EK.open : EK.wall);
        g.append(s('line', { x1, y1, x2, y2, class: `map-edge ${EDGE_CLASS[kind] ?? 'wall'}` }));
      }
      if (x.state === 'current') g.append(s('rect', { class: 'mm-here', x: b.x0 + 0.5, y: b.y0 + 0.5, width: b.x1 - b.x0 - 1, height: b.y1 - b.y0 - 1 })); // MAP-33: where you are
      g.append(s('title', {}, `${cap(z.name)}: ${Math.round(z.rect!.w)} × ${Math.round(z.rect!.d)} m`));
      gZones.append(g);
      const n = nameIn(z.name, c);
      if (!n) continue;
      const cx = (c.x0 + c.x1) / 2, first = (c.y0 + c.y1) / 2 - ((n.lines.length - 1) * n.line) / 2 + n.size * 0.36;
      gNames.append(s('text', { class: `mm-name${z.here ? ' here' : ''}`, x: cx, y: first, 'text-anchor': 'middle', 'font-size': n.size,
        'data-role': 'label', 'data-layer': 'back', 'data-id': `label:${z.id}`, 'data-for': z.id, 'data-placement': 'inside' },
      ...n.lines.map((line, i) => s('tspan', { x: cx, y: first + i * n.line }, line))));
    }
    for (const c of scene.connectors) gZones.append(s('line', { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, class: `map-link${c.sight ? '' : ' hidden-view'}` }, s('title', {}, c.title)));
    // AD9: how far one move slot walks this turn; past the widest zoom it is a note under the map instead
    if (snap.ring !== null && 2 * snap.ring <= widest) { const y = px(snap.you, K); gRing.append(s('circle', { class: 'mm-ring', cx: y.x, cy: y.y, r: snap.ring * K })); }
    // marks: the full Map's (doors, stairs, furniture, people), each only when it is whole in view (MAP-50)
    for (const d of scene.doors) {
      if (!within(d, inView)) continue;
      const r = d.x1 - d.cx, tag = { 'data-role': 'icon', 'data-id': d.id, role: 'img', 'aria-label': d.title };
      gMarks.append(d.way?.shut ? s('g', { class: `map-way ${d.way.shut}${d.way.key ? ' key' : ''}`, ...tag }, s('circle', { cx: d.cx, cy: d.cy, r }), ...wayGlyph(d.cx, d.cy, d.way.shut), s('title', {}, d.title))
        : d.kind === 'group' ? s('g', { class: 'map-door group', ...tag }, s('circle', { cx: d.cx, cy: d.cy, r }), s('text', { x: d.cx, y: d.cy + 4, 'text-anchor': 'middle' }, String(d.count)), s('title', {}, d.title))
        : s('g', { class: `map-door ${d.kind}`, ...tag }, ...doorGlyph(d.cx, d.cy, d.kind, d.dir), s('title', {}, d.title)));
    }
    for (const st of scene.stairs) if (within(st, inView)) gMarks.append(s('g', { class: `map-stair${st.goto ? '' : ' unknown'}`, 'data-role': 'icon', 'data-id': st.id, role: 'img', 'aria-label': st.title },
      s('circle', { cx: st.cx, cy: st.cy, r: st.x1 - st.cx }), s('text', { x: st.cx, y: st.cy + 4, 'text-anchor': 'middle' }, st.up ? '▲' : '▼'), s('title', {}, st.title)));
    for (const f of scene.furniture) if (within(f, inView)) { const g = furnIcon(f.kind, cap(f.name), f.cx, f.cy); g.setAttribute('data-role', 'icon'); g.setAttribute('data-id', f.id); gMarks.append(g); }
    for (const t of scene.tokens) {
      if (!within(t, inView)) continue;
      if (t.you) {
        // you, facing the way you last walked (BG-18)
        const f = snap.facing, a = f ? Math.atan2(-f[1], f[0]) : null, tip = (d: number, r: number) => `${t.cx + Math.cos(a! + d) * r} ${t.cy + Math.sin(a! + d) * r}`;
        gTokens.append(s('g', { class: 'mm-you' }, ...(a === null ? [] : [s('path', { d: `M${tip(0, t.r + 6)} L${tip(0.5, t.r)} L${tip(-0.5, t.r)}Z` })]),
          s('g', { 'data-role': 'token', 'data-id': 'you' }, s('circle', { cx: t.cx, cy: t.cy, r: t.r })), s('text', { x: t.cx, y: t.cy + 3, 'text-anchor': 'middle' }, 'You'), s('title', {}, 'You are here')));
        continue;
      }
      const who = t.who!, g = s('g', { class: `map-who plan-who${who.now ? '' : ' last'}${who.at ? ' at' : ''}`, tabindex: 0, role: 'button', 'aria-label': `${t.title}: what to do` },
        s('g', { 'data-role': 'token', 'data-id': t.id }, s('circle', { cx: t.cx, cy: t.cy, r: t.r }), s('text', { x: t.cx, y: t.cy + 3, 'text-anchor': 'middle' }, whoInitial(who.name))),
        s('text', { x: t.cx + t.r + 4, y: t.cy + 4, class: 'map-who-label' }, who.name), s('title', {}, t.title));
      const open = (e: Event) => { e.stopPropagation(); if (!api.busy()) opts.onPerson(who.id, (g as Element).getBoundingClientRect()); };
      g.addEventListener('click', open);
      g.addEventListener('dblclick', (e) => e.stopPropagation());
      g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); open(e); } });
      gTokens.append(g);
    }
    drawPath();
    foot();
    scheduleCheck();
  }

  /** the hovered walk (dotted, amber past what this turn walks) and the planned one (solid), each with its end */
  function drawPath() {
    gPath.replaceChildren();
    if (!snap) return;
    const { K } = frame(), ring = snap.ring;
    const line = (pts: Pos[], cls: string) => s('polyline', { class: cls, points: pts.map((q) => { const p = px(q, K); return `${p.x},${p.y}`; }).join(' ') });
    for (const [p, set] of [[plan, true], [hover && 'pts' in hover ? hover : null, false]] as const) {
      if (!p) continue;
      const [now, later] = ring === null ? [p.pts, []] : splitAt(p.pts, ring), end = px(p.pts[p.pts.length - 1], K), cls = `mm-path${set ? ' set' : ''}`;
      gPath.append(line(now, cls), ...(later.length > 1 ? [line(later, `${cls} far`)] : []),
        s('circle', { class: `mm-goal${set ? ' set' : ''}${later.length > 1 ? ' far' : ''}`, cx: end.x, cy: end.y, r: 7 }));
    }
  }

  /** the footer: what the pointed spot takes, or why there is no way there; the plan; the hint. Small on the right, the
   *  turn time carried over (AD9), and a ring too big to draw */
  function foot() {
    const shown = hover ?? plan;
    const parts = (p: Extract<MinimapPlan, { pts: Pos[] }>) => {
      const [m, ...rest] = p.words.split(' · '), last = rest.length > 1 && snap?.ring !== null ? rest.pop()! : null;
      return [h('b', {}, m), ...rest.map((x) => ` · ${x}`), ...(last ? [' · ', h('b', { class: p.turns === 1 ? 'now' : 'far' }, last)] : []), ` · ${p.where}`];
    };
    say.replaceChildren(...(!snap ? ['No map of where you are yet.'] : !shown ? [HINT] : 'why' in shown ? [shown.why] : [...(shown === plan && !hover ? ['Planned: '] : []), ...parts(shown)]));
    go.hidden = !plan;
    const notes = [snap && snap.carried > 0 ? `+${r1(snap.carried)} s carried over` : '', snap?.ring && 2 * snap.ring > widest ? `this turn reaches ${metresText(snap.ring)}` : ''].filter(Boolean);
    carried.textContent = notes.join(' · ');
    floorEl.textContent = snap ? `· ${floorName(snap.height)}` : '';
  }

  function zoom(dir: number) {
    if (api.busy()) return; // M-06
    const at = steps.reduce((b, x, i) => (Math.abs(x - viewM) < Math.abs(steps[b] - viewM) ? i : b), 0);
    const next = steps[Math.max(0, Math.min(steps.length - 1, at + dir))];
    if (next === viewM) return;
    pan = { x: (pan.x * viewM) / next, y: (pan.y * viewM) / next }; // the same metres off you
    viewM = next;
    render();
  }
  function recentre() { if (!api.busy()) { pan = { x: 0, y: 0 }; render(); } }
  function setPlan(p: Extract<MinimapPlan, { pts: Pos[] }>) {
    const same = plan && plan.zone === p.zone && plan.x === p.x && plan.y === p.y;
    plan = p;
    if (!same) opts.onPlan(point(p));
    drawPath(); foot();
  }
  function clear() { if (!plan) return; plan = null; opts.onPlan(null); drawPath(); foot(); }

  // pointing, clicking, dragging the view, the wheel and keys; none of it while a turn runs (M-06)
  const svgAt = (e: MouseEvent) => { const r = svg.getBoundingClientRect(), { w, h: hh } = size(); return { x: ((e.clientX - r.left) * w) / (r.width || w), y: ((e.clientY - r.top) * hh) / (r.height || hh) }; };
  function pointAt(e: MouseEvent): MinimapPlan | null {
    const st = api.state();
    if (!snap || !st || api.busy()) return null;
    const { K, o } = frame(), at = svgAt(e), q = { x: (at.x - o.x) / K, y: -(at.y - o.y) / K }, z = zoneAt(snap.floor, q);
    return z ? planTo(st, snap.km, z.id, q) : { why: 'You don’t know what is there.' };
  }
  let drag: { x: number; y: number; pan: Pos; moved: boolean } | null = null;
  svg.addEventListener('pointerdown', (e) => { if (e.button === 0 && !api.busy()) drag = { x: e.clientX, y: e.clientY, pan: { ...pan }, moved: false }; });
  svg.addEventListener('pointermove', (e) => {
    if (api.busy()) return;
    if (drag && e.buttons & 1 && (drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4)) {
      const r = svg.getBoundingClientRect(), f = size().w / (r.width || size().w);
      drag.moved = true;
      pan = { x: drag.pan.x + (e.clientX - drag.x) * f, y: drag.pan.y + (e.clientY - drag.y) * f };
      render();
      return;
    }
    hover = pointAt(e);
    svg.classList.toggle('no-way', !!hover && 'why' in hover);
    drawPath(); foot();
  });
  svg.addEventListener('pointerleave', () => { if (api.busy()) return; hover = null; svg.classList.remove('no-way'); drawPath(); foot(); });
  svg.addEventListener('click', (e) => {
    const dragged = drag?.moved; drag = null;
    if (dragged) return;
    const p = pointAt(e);
    if (p && 'pts' in p) setPlan(p);
  });
  svg.addEventListener('dblclick', (e) => { const p = pointAt(e); if (p && 'pts' in p) { setPlan(p); opts.onWalk(point(p)); } });
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.sign(e.deltaY)); }, { passive: false });
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && plan && !api.busy()) { e.preventDefault(); opts.onWalk(point(plan)); }
    else if (e.key === 'Escape' && plan) { e.preventDefault(); clear(); }
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => snap && render()).observe(svg);

  // MAP-51: in dev views (?fake= or ?mapcheck) the checker runs on every render, once the browser has laid it out
  const devCheck = typeof location !== 'undefined' && /[?&](fake|mapcheck)\b/.test(location.search);
  let checkTimer = 0;
  function scheduleCheck() {
    if (!devCheck) return;
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => requestAnimationFrame(() => {
      if (!snap || !svg.isConnected) return;
      const ids = snap.every.map((z) => z.id), have = new Set(ids), here = snap.every.find((z) => z.here)?.id ?? ids[0];
      const findings = [...checkMap(svg), ...checkReach(ids, snap.every.flatMap((z) => z.links.filter((l) => have.has(l.to)).map((l) => [z.id, l.to] as [string, string])), here)];
      (window as unknown as { __minimapFindings?: unknown }).__minimapFindings = { viewM, findings };
      if (findings.length) for (const f of findings) console.warn('[minimap-check]', f);
      else console.info('[minimap-check] 0 findings');
    }), 120);
  }

  function update() {
    if (api.busy()) return; // M-06: nothing changes while a turn runs
    const st = api.state(), km = st ? knownMap(st) : null;
    const root = km ? rootPlace(km, km.placeId) : '';
    const every = km ? km.places.filter((p) => rootPlace(km, p.id) === root).flatMap((p) => p.zones).filter((z) => z.rect) : [];
    const here = every.find((z) => z.here);
    if (!st || !km || !here?.you) { snap = null; hover = null; if (plan) { plan = null; opts.onPlan(null); } render(); return; }
    const ring = ringMetres(st);
    snap = { km, every, floor: every.filter((z) => z.height === here.height), height: here.height, you: { ...here.you }, ...(st.player.facing ? { facing: [...st.player.facing] as [number, number] } : {}), ring, carried: carriedMoveS(st) };
    const at = `${here.id}:${here.you.x}:${here.you.y}`;
    if (at !== lastAt) { lastAt = at; pan = { x: 0, y: 0 }; hover = null; }
    // AD9: a ring wider than the view zooms out to fit it (across the view's short side), up to the widest zoom; past it
    // the footer says how far
    if (ring !== lastRing) {
      const { w, h: hh } = size(), need = (2.1 * (ring ?? 0) * w) / Math.min(w, hh);
      lastRing = ring;
      if (need > viewM) viewM = steps.find((x) => x >= need) ?? widest;
    }
    if (plan) {
      const again = planTo(st, km, plan.zone, plan);
      if (!('pts' in again)) { plan = null; opts.onPlan(null); }
      else if (again.metres !== plan.metres || again.turns !== plan.turns) { plan = again; opts.onPlan(point(again)); }
      else plan = again;
    }
    render();
  }

  update();
  return { el, update, clear, planned: () => (plan ? point(plan) : null) };
}
