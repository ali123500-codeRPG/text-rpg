// FR1–FR4: furnished rooms. A zone lists named furniture with where it stands (a compass side or corner, or the middle).
// It is colour first (FR1): a move can end beside a piece, and search and stash work where one stands; it never blocks or
// hides anything. FR2: a zone gets its kind's defaults unless a layout or the Weaver lists its own. FR4: a piece on an edge
// (a counter, a rail) is one record on one zone and shows on the far side of that edge too.
import type { Furniture, GameState, PlanFurniture, Side, Zone } from '../types';
import { getLibrary } from '../library';
import { FU } from '../library/tableIds';
import { compassOf, edgeToward } from '../scenario/geometry';
import { zoneById } from './relations';

const WORDS: Record<string, string> = { n: 'north', ne: 'north east', e: 'east', se: 'south east', s: 'south', sw: 'south west', w: 'west', nw: 'north west' };
const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** how far in from the wall a piece on a side stands, in metres */
const INSET_M = 0.5;

/** FR2: a zone's furniture from a list (unknown kinds count as "other"), with ids `${zone}.fu${n}` */
export const makeFurniture = (zoneId: string, list: PlanFurniture[]): Furniture[] => list.filter((x) => x?.name).map((x, i) => ({
  id: `${zoneId}.fu${i + 1}`, kind: getLibrary().furnitureKinds?.[x.kind] ? x.kind : FU.other, name: x.name,
  ...(x.at && WORDS[x.at.toLowerCase()] || x.at && compassOf(x.at) ? { at: x.at.toLowerCase() } : {}), ...(x.edge && x.at ? { edge: true as const } : {}),
}));

/** the side of zone `from` that faces `to` (by their centres) */
function facing(from: Zone, to: Zone): Side | null {
  if (!from.rect || !to.rect) return null;
  const dx = to.rect.x - from.rect.x, dy = to.rect.y - from.rect.y;
  if (!dx && !dy) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 'n' : 's';
}

/** FR4: everything that stands in a zone: its own pieces, and the edge pieces of the zones it links to across their edge */
export function furnitureIn(state: GameState, zoneId: string): Furniture[] {
  const z = zoneById(state, zoneId);
  if (!z) return [];
  const out = [...(z.furniture ?? [])];
  for (const l of z.links) {
    const b = l.frontier ? undefined : zoneById(state, l.to);
    const side = b && facing(b, z);
    for (const f of b?.furniture ?? []) if (f.edge && side && f.at === side && !out.some((x) => x.id === f.id)) out.push({ ...f, at: OPPOSITE[side] });
  }
  return out;
}

/** where a piece stands in its zone's frame: on its side, INSET_M in from the edge; the middle when it names no side */
export function furniturePos(state: GameState, zoneId: string, f: Furniture): { x: number; y: number } | undefined {
  const r = zoneById(state, zoneId)?.rect;
  if (!r) return undefined;
  const d = f.at ? compassOf(WORDS[f.at] ?? f.at) : null;
  if (!d) return { x: r.x, y: r.y };
  const p = edgeToward(r, d), dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy), m = f.edge ? 0 : Math.min(INSET_M, len);
  return len ? { x: p.x + (dx / len) * m, y: p.y + (dy / len) * m } : p;
}

/** a piece in a zone by id (its own or an edge piece seen from this side) */
export const furnitureById = (state: GameState, zoneId: string, id: string): Furniture | undefined => furnitureIn(state, zoneId).find((f) => f.id === id);

/** a piece's place in words: "north side", "south-west corner", "middle" */
export function furnitureWhere(f: Furniture): string {
  const w = f.at ? WORDS[f.at] ?? f.at : '';
  return !w ? 'middle' : w.includes(' ') ? `${w.replace(' ', '-')} corner` : `${w} side`;
}
