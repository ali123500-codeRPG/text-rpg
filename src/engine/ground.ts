// PZ11 a, PZ2: what lies on the ground lies at a point on the floor plan (GameState.ground, each item's `at`: a point and
// its floor). The title it lies in is the title of that point (plan/where zoneAt), never a list kept on the title.
import type { GameState, ItemInstance, Pt3 } from '../types';
import { zoneAt } from '../plan/where';
import { keepInside, middleOf } from '../plan/geom';
import { zoneById } from './relations';
import type { Located } from './position';

/** the title an item on the ground lies in (undefined: off every title) */
export const groundZoneOf = (state: GameState, i: ItemInstance): string | undefined => (i.at ? zoneAt(state, i.at, i.at.floor)?.id : undefined);
/** everything that lies on the ground in a title */
export const groundIn = (state: GameState, zoneId: string): ItemInstance[] => state.ground.filter((i) => groundZoneOf(state, i) === zoneId);
/** the point something at `at` stands on: its own point, else its title's middle (its floor with it) */
export function groundPoint(state: GameState, at: Located): Pt3 | undefined {
  const z = zoneById(state, at.zone);
  if (!z?.outline?.length) return undefined;
  const p = at.pos ?? keepInside(middleOf(z.outline), z.outline, 0);
  return { x: p.x, y: p.y, floor: z.floor };
}
/** FR2: lays items on the ground where `at` stands (its point, else its title's middle) */
export function dropOnGround(state: GameState, at: Located, ...items: ItemInstance[]): void {
  const p = groundPoint(state, at);
  for (const i of items) state.ground.push(p ? { ...i, at: { ...p } } : i);
}
/** takes an item off the ground by id: the item, or undefined when nothing lies there with that id */
export function takeFromGround(state: GameState, id: string): ItemInstance | undefined {
  const k = state.ground.findIndex((i) => i.id === id);
  return k < 0 ? undefined : state.ground.splice(k, 1)[0];
}
