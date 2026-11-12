// Zone geometry (CO1, CO4, CO15, CO16): code, never Claude, gives every zone a rectangle in metres. Its area comes from
// the zone's size; its shape from the kind's aspect (corridors and streets are long); where it sits from the compass words
// of the exits that join it to zones already placed ("the north door" puts it north of the zone it leads from), touching
// that zone's side. Zones up or down stairs sit straight above or below (height never moves a zone across the map).
// Shape is a plain rectangle while CO2 (zone shape) is parked.
import type { GameState, Rect, Side, Zone } from '../types';
import { CONFIG } from '../config';
import { heightOf, verticalOf } from './heights';

/** the compass direction an exit's words name, as a unit [east, north], or null when they name none */
export function compassOf(label: string): [number, number] | null {
  let e = 0, n = 0;
  for (const w of label.toLowerCase().split(/[^a-z]+/)) {
    const m = w.match(/^(north|south)?(east|west)?(ward|wards|ern)?$/);
    if (m && (m[1] || m[2])) { if (m[1] === 'north') n += 1; if (m[1] === 'south') n -= 1; if (m[2] === 'east') e += 1; if (m[2] === 'west') e -= 1; }
  }
  if (!e && !n) return null;
  const len = Math.hypot(e, n);
  return [e / len, n / len];
}

/** the point on a rectangle's edge straight out from its centre along `d` (a direction [east, north], any length) */
export function edgeToward(r: Rect, d: [number, number]): { x: number; y: number } {
  const k = Math.min(d[0] ? r.w / 2 / Math.abs(d[0]) : Infinity, d[1] ? r.d / 2 / Math.abs(d[1]) : Infinity);
  return k === Infinity ? { x: r.x, y: r.y } : { x: r.x + d[0] * k, y: r.y + d[1] * k };
}

const STEP: Record<Side, [number, number]> = { n: [0, 1], e: [1, 0], s: [0, -1], w: [-1, 0] };
const sideOf = (d: [number, number]): Side => (Math.abs(d[0]) >= Math.abs(d[1]) ? (d[0] >= 0 ? 'e' : 'w') : d[1] >= 0 ? 'n' : 's');
export const sameFloor = (a: Zone, b: Zone) => Math.abs(heightOf(a) - heightOf(b)) < CONFIG.STOREY_HEIGHT / 2;
const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) * 2 < a.w + b.w - 0.01 && Math.abs(a.y - b.y) * 2 < a.d + b.d - 0.01;

/** width (east-west) and depth (north-south) of a zone's rectangle: its area at its aspect, the long side along `axis` */
function dims(z: Zone, axis: 'ew' | 'ns'): [number, number] {
  const area = z.area ?? CONFIG.ZONE_SIZE_M2.room;
  const r = Math.max(1, z.aspect ?? 1);
  const short = Math.sqrt(area / r), long = short * r;
  return axis === 'ew' ? [long, short] : [short, long];
}

/** the exit between two zones read from `from`'s side: its compass direction and whether it climbs or drops */
function exitBetween(from: Zone, to: Zone): { dir: [number, number] | null; vertical: number } {
  const out = from.links.find((l) => l.to === to.id), back = to.links.find((l) => l.to === from.id);
  const fwd = out ? compassOf(out.label) : null;
  const rev = back ? compassOf(back.label) : null;
  // heights, once settled (inferHeights runs first and reads the exit from the settled side), decide whether the exit
  // climbs: an exit's words read both ways can disagree ("the low tunnel" one way, "back up into the cellar" the other),
  // and stacking two zones of one height put them on top of each other on the same floor (run 36)
  const settled = from.height !== undefined || to.height !== undefined;
  const vertical = settled ? (sameFloor(from, to) ? 0 : Math.sign(heightOf(to) - heightOf(from)))
    : (out ? verticalOf(out.label) : 0) || (back ? -verticalOf(back.label) : 0);
  return { dir: fwd ?? (rev ? [-rev[0], -rev[1]] : null), vertical };
}

/** gives each zone in `zones` without a rectangle one, next to a placed zone it links to (CO1 B) */
export function placeZones(state: GameState, zones: Zone[]): void {
  const all = state.places.flatMap((p) => p.zones);
  const byId = new Map(all.map((z) => [z.id, z]));
  const open = new Set(zones.filter((z) => !z.rect).map((z) => z.id));
  const placed = () => all.filter((z) => z.rect);
  const free = (z: Zone, r: Rect) => !placed().some((o) => o !== z && sameFloor(o, z) && overlaps(o.rect!, r));
  for (let pass = 0; open.size && pass < 200; pass++) {
    let progress = false;
    for (const id of [...open]) {
      const z = byId.get(id)!;
      const near = [...z.links.map((l) => byId.get(l.to)), ...all.filter((o) => o.links.some((l) => l.to === z.id))].find((o) => o?.rect);
      if (!near) continue;
      const p = near.rect!;
      const { dir, vertical } = exitBetween(near, z);
      if (vertical || !sameFloor(near, z)) {
        const [w, d] = dims(z, p.w >= p.d ? 'ew' : 'ns');
        z.rect = { x: p.x, y: p.y, w, d }; // up or down the stairs: straight above or below
      } else {
        const sides: Side[] = dir ? [sideOf(dir)] : ['e', 's', 'w', 'n'];
        const at = (side: Side): Rect => {
          const [sx, sy] = STEP[side];
          const [w, d] = dims(z, sx ? 'ew' : 'ns');
          return { x: p.x + sx * (p.w + w) / 2, y: p.y + sy * (p.d + d) / 2, w, d };
        };
        // touch the near zone's side: centred on it, else lined up with either end of it, on any side the exit allows
        // (BG-7: a blocked first side no longer leaves a gap while another side is free); only when every touching spot
        // is in the way, slide outward from the first side's centred spot until nothing on this floor is
        let best: Rect | undefined;
        for (const side of sides) {
          const r = at(side), sx = STEP[side][0];
          const shifts = [0, 1, -1].map((k) => (sx ? [0, k * (p.d - r.d) / 2] : [k * (p.w - r.w) / 2, 0]));
          best = shifts.map(([ex, ny]) => ({ ...r, x: r.x + ex, y: r.y + ny })).find((c) => free(z, c));
          if (best) break;
        }
        if (!best) {
          const r = at(sides[0]), [sx, sy] = STEP[sides[0]];
          for (let k = 0; k < 100 && !free(z, r); k++) { r.x += sx * r.w / 2; r.y += sy * r.d / 2; }
          best = r;
        }
        z.rect = best;
      }
      open.delete(id); progress = true;
    }
    if (!progress) {
      // nothing to go by (a story's first zones, or a place with no link to anything placed): start east of everything
      const z = byId.get([...open][0])!;
      const rs = placed().map((o) => o.rect!);
      const [w, d] = dims(z, 'ew');
      const x = rs.length ? Math.max(...rs.map((r) => r.x + r.w / 2)) + 20 + w / 2 : 0;
      z.rect = { x, y: 0, w, d };
      open.delete(z.id);
    }
  }
}

/** CO3: the doorway between two zones that touch, at the middle of their shared wall; null when they don't share one */
export function doorway(a: Zone, b: Zone): { x: number; y: number } | null {
  if (!a.rect || !b.rect) return null;
  const A = a.rect, B = b.rect;
  const x0 = Math.max(A.x - A.w / 2, B.x - B.w / 2), x1 = Math.min(A.x + A.w / 2, B.x + B.w / 2);
  const y0 = Math.max(A.y - A.d / 2, B.y - B.d / 2), y1 = Math.min(A.y + A.d / 2, B.y + B.d / 2);
  if (x1 < x0 - 0.01 || y1 < y0 - 0.01) return null;
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/** metres between two zones' centres across the map (height left out) */
export const zoneDistanceM = (a: Zone, b: Zone): number | null => (a.rect && b.rect ? Math.hypot(a.rect.x - b.rect.x, a.rect.y - b.rect.y) : null);

/** HB4: the edge kind id of `a`'s side facing `b` (its kind's default when unnamed); null without rectangles */
export function edgeFacing(a: Zone, b: Zone): string | null {
  if (!a.rect || !b.rect) return null;
  return a.edges?.[sideOf([b.rect.x - a.rect.x, b.rect.y - a.rect.y])] ?? null;
}

/** BG-62: whether `a`'s side facing `b` is an edge you reach over but don't walk across (a counter, fence or rail) */
export function reachesOver(a: Zone, b: Zone, edgeKinds: Record<string, { walk: boolean; reach: boolean }>): boolean {
  if (!a.rect || !b.rect) return false;
  const k = edgeKinds[a.edges?.[sideOf([b.rect.x - a.rect.x, b.rect.y - a.rect.y])] ?? ''];
  return !!k && k.reach && !k.walk;
}
