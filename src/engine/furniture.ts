// FR1–FR4, PZ2: furnished rooms. Each piece of furniture stands at a point on the floor plan (GameState.furniture), named
// and listed with the title it was drawn in, where it stands there (a compass side or corner, or the middle). It is
// colour first (FR1): a move can end beside a piece, and search and stash work where one stands; it never blocks a walk,
// but it hides what is behind it (PC1, PC2: its kind's sizeM; ruleset/objectCover). FR2: a title gets its kind's defaults
// unless a layout or the Weaver lists its own. FR4: a piece on an edge (a counter, a rail) stands on that edge and shows
// in the title on its far side too.
import type { Furniture, GameState, Side } from '../types';
import { OPP_SIDE } from '../types';
import { zoneById } from './relations';
import { inTitle } from '../plan/where';
export { makeFurniture } from '../plan/draw';

const WORDS: Record<string, string> = { n: 'north', ne: 'north east', e: 'east', se: 'south east', s: 'south', sw: 'south west', w: 'west', nw: 'north west' };

/** FR4: everything that stands in a title: its own pieces, and the edge pieces of other titles on its edge */
export function furnitureIn(state: GameState, zoneId: string): Furniture[] {
  const z = zoneById(state, zoneId);
  if (!z) return [];
  return state.furniture.filter((f) => f.zone === zoneId || (f.edge && Math.abs(f.floor - z.floor) < 0.01 && inTitle(z, f.pos, 0.05)));
}

/** where a piece stands */
export const furniturePos = (_state: GameState, _zoneId: string, f: Furniture): { x: number; y: number } => f.pos;

/** a piece in a title by id (its own or an edge piece seen from this side) */
export const furnitureById = (state: GameState, zoneId: string, id: string): Furniture | undefined => furnitureIn(state, zoneId).find((f) => f.id === id);

/** the stored record of a piece by id: where its grade is kept (OD3) */
export const furnitureRecord = (state: GameState, id: string): Furniture | undefined => state.furniture.find((f) => f.id === id);

/** the side across from a side or corner (OPP_SIDE, each letter of a corner turned) */
const opposite = (side: string): string => side.split('').map((c) => OPP_SIDE[c as Side] ?? c).join('');
/** a piece's place in words: "north side", "south-west corner", "middle"; FR4: an edge piece seen from the title on its far
 * side (`from`) stands on that title's opposite side */
export function furnitureWhere(f: Furniture, from?: string): string {
  const side = f.side && f.edge && from && from !== f.zone ? opposite(f.side) : f.side;
  const w = side ? WORDS[side] ?? side : '';
  return !w ? 'middle' : w.includes(' ') ? `${w.replace(' ', '-')} corner` : `${w} side`;
}
