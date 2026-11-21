// PZ11 a, PZ2: what lies on the ground lies at a point on the floor plan (GameState.ground, each item's `at`: a point and
// its floor). The title it lies in is the title of that point (plan/where zoneAt), never a list kept on the title.
import type { GameState, ItemInstance, Pt3 } from '../types';
import { zoneAt } from '../plan/where';
import { zoneById } from './relations';
import { floorOf, titleMiddle, type Located } from './position';

/** the title an item on the ground lies in (undefined: off every title) */
export const groundZoneOf = (state: GameState, i: ItemInstance): string | undefined => (i.at ? zoneAt(state, i.at, i.at.floor)?.id : undefined);
/** everything that lies on the ground in a title */
export const groundIn = (state: GameState, zoneId: string): ItemInstance[] => state.ground.filter((i) => groundZoneOf(state, i) === zoneId);
/** D-1623: the point something at `at` stands on: its own point and height, else its title's middle on its floor */
function groundPoint(state: GameState, at: Located): Pt3 {
  if (at.pos) return { x: at.pos.x, y: at.pos.y, floor: floorOf(state, at) };
  const z = zoneById(state, at.zone);
  if (!z) throw new Error(`no title ${at.zone} to lay things in`);
  return titleMiddle(z);
}
/** FR2: lays items on the ground where `at` stands (its point, else its title's middle); the same objects, so a caller
 * that keeps one (a stash marking it hidden) changes what lies there. D-1623: everything on the ground has a point. */
export function dropOnGround(state: GameState, at: Located, ...items: ItemInstance[]): void {
  const p = groundPoint(state, at);
  for (const i of items) { i.at = { ...p }; state.ground.push(i); }
}
/** takes an item off the ground by id: the item, or undefined when nothing lies there with that id */
export function takeFromGround(state: GameState, id: string): ItemInstance | undefined {
  const k = state.ground.findIndex((i) => i.id === id);
  return k < 0 ? undefined : state.ground.splice(k, 1)[0];
}
