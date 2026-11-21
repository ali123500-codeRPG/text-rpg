// The play screen's minimap (AD8–AD16): the floor you stand on, centred on you and drawn to scale from what the character
// knows (knownMap, as the full Map), its marks laid out by the full Map's own code (planScene: MAP-23, MAP-25, MAP-31).
// Point anywhere known to see the walk there through the doorways as the engine walks it (walkRoute) and how long it
// takes; a click plans a move to that exact point (MoveSpot.at, AD16), a double-click, Enter or Just go walks at once, Esc
// clears. In a fight a ring shows how far one move slot walks this turn, carried time included (AD9), and a second, wider
// ring how far a dash runs (BF91: the move time walked, then the main time run). Only colour and
// opacity change, on hover (M-70); nothing changes while a turn runs (M-06).
import { areaOf, inOutline } from '../plan/geom';
import { seenIn } from '../plan/fog';
import type { GameApi, GameState } from '../types';
import { CONFIG } from '../config';
import { knownMap, type KnownMap, type MapZone } from './mapData';
import { wayWords } from './map';
import { planView, type PlanOpts } from './planView';
import { carriedS, moveSpeed, slotMetres, turnMetres } from '../engine/speed';
import { M_EPS, spotPoint, walkRoute, type Pos } from '../engine/position';
import { shortestPath } from '../engine/relations';
import { distText } from '../views';
import { r1, theName } from '../words';

export type MinimapPoint = { zone: string; x: number; y: number; metres: number; seconds: number; turns: number; label: string };
/** a point's plan: the walk there (its points, in metres) and how it reads on the path; or why there is no way there */
export type MinimapPlan = (MinimapPoint & { pts: Pos[]; words: string; where: string }) | { why: string };

/** AD9: metres one move slot walks this turn, carried time included (turnMetres, as the engine walks it); null outside a
 *  fight (no ring) */
export const ringMetres = (s: GameState): number | null => (s.mode === 'tactical' ? turnMetres(s, s.player, 'move') : null);
/** BF91: metres a dash covers this turn (a move slot walked, then the main slot run), carried time included; null outside
 *  a fight */
export const dashMetres = (s: GameState): number | null => {
  const walk = ringMetres(s);
  return walk === null ? null : walk + turnMetres(s, s.player, 'main');
};
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
  // PZ1: by its outline (a title can be any shape), the smallest first
  const size = (z: MapZone) => (z.outline?.length ? areaOf(z.outline) : z.rect!.w * z.rect!.d);
  // BG-313: only ground the character has seen (the fog) is somewhere to point at
  const hits = zones.filter((z) => z.rect && (z.outline?.length ? inOutline(q, z.outline) : Math.abs(q.x - z.rect.x) <= z.rect.w / 2 && Math.abs(q.y - z.rect.y) <= z.rect.d / 2) && (!z.seen || seenIn(z.seen, q)));
  return hits.sort((a, b) => size(a) - size(b))[0];
}

/** the minimap (AD8–AD16): the shared map view (planView, MAP-84) at its small size, centred on you, on the floor you
 *  stand on. A right-click or long press on a zone, an exit or a way to another map opens the full Map there (MQ3). */
export function minimapPanel(api: GameApi, opts: {
  onPlan(p: MinimapPoint | null): void;
  onWalk(p: MinimapPoint): void;
  onThing: PlanOpts['onThing'];
  onOpenMap(at?: MapPick): void;
}): { el: HTMLElement; update(): void; clear(): void; planned(): MinimapPoint | null } {
  const v = planView(api, {
    size: 'mini',
    data: () => {
      const st = api.state(), km = st ? knownMap(st) : null;
      // D-1558: the one map, as the Map draws it: every zone known, the places inside a top-level place but a road, everyone on your floor
      const every = km ? km.places.flatMap((p) => p.zones).filter((z) => z.rect) : [];
      const here = every.find((z) => z.here);
      if (!st || !km || !here?.you) return null;
      const floor = every.filter((z) => z.height === here.height);
      const inside = (id: string, anc: string) => { for (let p = km.places.find((x) => x.id === id), n = 0; p && n < 20; p = km.places.find((x) => x.id === p!.parentId), n++) if (p.id === anc) return true; return false; };
      const places = km.places.filter((p) => p.depth > 0 && p.kind !== 'road').sort((a, b) => a.depth - b.depth)
        .map((p) => ({ id: p.id, name: p.name, depth: p.depth, zones: floor.filter((z) => inside(z.placeId, p.id)) })).filter((p) => p.zones.length);
      const people = km.people.filter((w) => Math.abs(w.height - here.height) < 0.01);
      return { km, every, floor, height: here.height, places, people, you: { ...here.you }, ...(st.player.facing ? { facing: [...st.player.facing] as [number, number] } : {}),
        ring: ringMetres(st), dash: dashMetres(st), carried: carriedS(st, st.player, 'move') };
    },
    onPlan: opts.onPlan, onWalk: opts.onWalk, onThing: opts.onThing,
    onCard: (zone) => opts.onOpenMap({ zone }),
    onExit: (zone, exit) => opts.onOpenMap({ zone, exit }),
    onGoto: (go) => opts.onOpenMap({ go }),
    onExpand: () => opts.onOpenMap(),
  });
  return { el: v.el, update: () => v.update(), clear: v.clear, planned: v.planned };
}
/** where the full Map opens from the minimap: a zone's card, an exit's card, or another map */
export type MapPick = { zone?: string; exit?: string; go?: string };
