// PC1, PC2: cover from real objects. Each piece of furniture has a size (its kind's sizeM: length, width, height in
// metres) and a point in its zone (furniturePos). Seen from a shooter or watcher, a piece hides what of the target lies
// below the sight line that grazes its top: the line from the viewer's eye over the far edge of the piece, carried on to
// the target. So a shooter on a wall or an upper floor sees over a low wall, and a piece right in front of the shooter
// hides nothing far off. With no viewer (hiding with nobody in particular to hide from), the tallest piece within
// CONFIG.OBJECT_COVER_M of the body hides its own height.
import type { Actor, Furniture, GameState, Opening, Pt, Zone } from '../types';
import { CONFIG } from '../config';
import { actorBody, getLibrary } from '../library';
import { furnitureIn, furniturePos } from '../engine/furniture';
import { spotOf, type Pos } from '../engine/position';
import { heightOf } from '../scenario/heights';
import { zoneById } from '../engine/relations';
import { crossings, openingsOn, seesNow } from '../plan/line';
import { dist } from '../plan/geom';

type Box = { lo: Pos; hi: Pos; h: number };

/** a piece's footprint (axis-aligned: along the wall it stands by, east-west in the middle) and height; none when its
 * kind has no size */
export function pieceBox(state: GameState, zone: Zone, f: Furniture): Box | undefined {
  const size = getLibrary().furnitureKinds?.[f.kind]?.sizeM;
  const p = size && furniturePos(state, zone.id, f);
  if (!size || !p) return undefined;
  const [len, wid, h] = size;
  const alongY = f.side === 'e' || f.side === 'w';
  const hx = (alongY ? wid : len) / 2, hy = (alongY ? len : wid) / 2;
  return { lo: { x: p.x - hx, y: p.y - hy }, hi: { x: p.x + hx, y: p.y + hy }, h };
}

/** where the segment a→b leaves the box, as a share of a→b (Liang-Barsky); undefined when it misses */
function exitShare(a: Pos, b: Pos, box: Box): number | undefined {
  let t0 = 0, t1 = 1;
  const d = { x: b.x - a.x, y: b.y - a.y };
  for (const [p, q] of [[-d.x, a.x - box.lo.x], [d.x, box.hi.x - a.x], [-d.y, a.y - box.lo.y], [d.y, box.hi.y - a.y]] as [number, number][]) {
    if (p === 0) { if (q < 0) return undefined; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 > t1) return undefined;
  }
  return t1;
}

/** the gap between a point and a box on the floor, in metres */
const boxGap = (p: Pos, box: Box): number => Math.hypot(Math.max(box.lo.x - p.x, 0, p.x - box.hi.x), Math.max(box.lo.y - p.y, 0, p.y - box.hi.y));

/** PC2: the share of `body` (0 to 1) hidden behind the pieces of furniture in its zone, seen from `from` */
export function objectHidden(state: GameState, body: Actor, zone: Zone, from?: Actor): number {
  const t = spotOf(state, body).pos;
  if (!t) return 0;
  const h = actorBody(state, body).size.heightM;
  const boxes = furnitureIn(state, zone.id).map((f) => pieceBox(state, zone, f)).filter((b): b is Box => !!b);
  const v = from && from.id !== body.id ? spotOf(state, from).pos : undefined;
  let hidden = 0;
  for (const box of boxes) {
    let above: number; // how high the piece hides at the target, above the target's floor
    if (v && from) {
      const dT = Math.hypot(t.x - v.x, t.y - v.y);
      const out = dT > 0 ? exitShare(v, t, box) : undefined;
      if (out === undefined || out >= 1) continue; // the line misses it, or the target stands on it
      const floorT = heightOf(zone);
      const eye = heightOf(zoneById(state, from.zone)) + actorBody(state, from).size.heightM * CONFIG.EYE_SHARE;
      const top = floorT + box.h;
      above = eye + (top - eye) / out - floorT; // the grazing line carried on to the target (dT ÷ dPiece = 1 ÷ out)
    } else {
      if (boxGap(t, box) > CONFIG.OBJECT_COVER_M) continue;
      above = box.h;
    }
    hidden = Math.max(hidden, Math.min(1, Math.max(0, above / h)));
  }
  return hidden;
}

/** PC3: the share of `body` that shows to `from` through the opening it is seen through (a window, a doorway, a gate): the
 * last opening on the line of sight. The opening's sill and top, carried along the sight line to the target, frame a
 * band of its height, and its width carried on the same way bounds how much of the target's width shows (an archer at
 * an arrow slit sees the whole field; a target behind one shows a strip). 1 when it is seen in the
 * same zone or across open ground. */
export function openingShown(state: GameState, body: Actor, zone: Zone, from?: Actor): number {
  if (!from || from.zone === zone.id) return 1;
  const t = spotOf(state, body).pos, v = spotOf(state, from).pos;
  if (!t || !v) return 1;
  const floorT = heightOf(zone), size = actorBody(state, body).size, h = size.heightM;
  const eye = heightOf(zoneById(state, from.zone)) + actorBody(state, from).size.heightM * CONFIG.EYE_SHARE;
  // PZ3: the last opening seen through that the sight line to the target passes, at whatever height (the frame below
  // shows how much of the target it lets through)
  let o: Opening | undefined, c: { at: Pt } | undefined;
  for (const x of crossings(state, { ...v, z: eye }, { ...t, z: eye })) {
    if (x.kind !== 'wall') continue;
    const hit = openingsOn(state, x.wall).find((q) => dist(q.at, x.at) <= q.widthM / 2 + 1e-6 && seesNow(state, q));
    if (hit) { o = hit; c = x; }
  }
  if (!o || !c) return 1;
  const w = c.at, dP = Math.hypot(w.x - v.x, w.y - v.y), dT = Math.hypot(t.x - v.x, t.y - v.y);
  if (dP <= 0 || dT <= dP) return 1;
  const sill = o.floor + (o.sillM ?? 0);
  const at = (y: number) => eye + (y - eye) * dT / dP - floorT; // a height on the opening, carried on to the target
  const band = Math.max(0, Math.min(h, at(sill + o.heightM)) - Math.max(0, at(sill))) / h;
  return band * Math.min(1, (o.widthM * dT / dP) / size.widthM); // the opening's width, carried on to the target as its height is
}
