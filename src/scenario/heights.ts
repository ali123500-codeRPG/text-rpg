// PZ7: a title's floor is metres above the ground outside (a cellar below it, a loft above), set by the ways that reach
// it (a way of kind up or down: plan/draw settleFloors), never by words. verticalOf only reads a label's words for the
// map's arrows.
import type { Zone } from '../types';

const UP = new Set(['upstairs', 'upward', 'upwards', 'above', 'loft', 'attic', 'roof', 'rooftop', 'climb', 'ascend']);
const DOWN = new Set(['downstairs', 'downward', 'downwards', 'below', 'cellar', 'basement', 'descend', 'underground']);
/** BG-6: a bare "up" or "down" goes up or down a storey only beside a way to climb ("the stairs up", "down the ladder");
 * "down the street" and "up the road" stay level */
const CLIMB = new Set(['stairs', 'stair', 'staircase', 'stairway', 'steps', 'ladder', 'hatch', 'trapdoor', 'rope', 'shaft', 'well', 'flight']);

/** +1 when an exit's words go up a storey, -1 down, 0 when they name neither */
export function verticalOf(label: string): -1 | 0 | 1 {
  const words = label.toLowerCase().split(/[^a-z]+/);
  const climb = words.some((w) => CLIMB.has(w));
  let v = 0;
  for (const w of words) { if (UP.has(w) || (climb && w === 'up')) v++; else if (DOWN.has(w) || (climb && w === 'down')) v--; }
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** PZ7: a title's floor in metres above the ground outside (0 when not known) */
export const heightOf = (z: Pick<Zone, 'floor'> | undefined): number => (z && Number.isFinite(z.floor) ? z.floor : 0);
