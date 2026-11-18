// PZ6 a: clutter at a point. Outdoors it is the land cell's cover (landCovers cover, and standsM: how high it stands);
// inside a settlement's land cell, and under a roof, the drawn plan's objects give it instead (furniture with sizes:
// carts, barrels, hedges; PC2, ruleset/objectCover).
import type { Cover, GameState, Pt } from '../types';
import { getLibrary } from '../library';
import { LC } from '../library/tableIds';
import { cellAt, regionAt } from '../land/sight';
import { coverOf } from '../land/generate';
import { underRoof } from './where';

/** PZ6 a: the scattered clutter at a point on a floor: its cover level and how high it stands */
export function clutterAt(state: GameState, p: Pt, floor: number): { cover: Cover; standsM: number } {
  if (underRoof(state, p, floor)) return { cover: 'none', standsM: 0 };
  const r = regionAt(state, p), i = r ? cellAt(r, p) : -1;
  const lc = r && i >= 0 ? coverOf(r, i) : undefined;
  const row = lc && lc !== LC.settlement ? getLibrary().landCovers?.[lc] : undefined;
  return row ? { cover: row.cover, standsM: row.standsM } : { cover: 'none', standsM: 0 };
}
