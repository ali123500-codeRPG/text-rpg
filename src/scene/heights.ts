// Zone height: metres above the ground outside (a top-level place's ground is 0; a cellar is below it, a loft above).
// Going up or down stairs changes height, never distance north, south, east or west. The Weaver may give a zone's
// height; when it doesn't, code infers it from the words of the exits that reach it ("the stairs up", "the cellar hatch, down").
import type { GameState, Zone } from '../types';
import { CONFIG } from '../config';

const UP = new Set(['up', 'upstairs', 'upward', 'upwards', 'above', 'loft', 'attic', 'roof', 'rooftop', 'climb', 'ascend']);
const DOWN = new Set(['down', 'downstairs', 'downward', 'downwards', 'below', 'cellar', 'basement', 'descend', 'underground']);

/** +1 when an exit's words go up a storey, -1 down, 0 when they name neither */
export function verticalOf(label: string): -1 | 0 | 1 {
  let v = 0;
  for (const w of label.toLowerCase().split(/[^a-z]+/)) { if (UP.has(w)) v++; else if (DOWN.has(w)) v--; }
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** a zone's height in metres (0 when unset: at ground level) */
export const heightOf = (z: Pick<Zone, 'height'> | undefined): number => z?.height ?? 0;

/** gives each new zone without a height one: across an exit that goes up or down, a storey (CONFIG.STOREY_HEIGHT) above
 *  or below the zone it leads from; across a level exit, the same height. Outdoor zones with nothing to go by sit at 0. */
export function inferHeights(state: GameState, zones: Zone[]): void {
  const open = new Set(zones.filter((z) => z.height === undefined).map((z) => z.id));
  const known = (id: string) => !open.has(id);
  const all = new Map(state.places.flatMap((p) => p.zones).map((z) => [z.id, z]));
  for (let pass = 0; open.size && pass < 50; pass++) {
    let changed = false;
    for (const id of [...open]) {
      const z = all.get(id)!;
      // an exit from a zone whose height is settled, read from that zone's side; else this zone's own exit, reversed
      let h: number | undefined;
      for (const [from, label, sign] of [
        ...[...all.values()].flatMap((y) => y.links.filter((l) => l.to === id && known(y.id)).map((l) => [y, l.label, 1] as const)),
        ...z.links.filter((l) => all.has(l.to) && known(l.to)).map((l) => [all.get(l.to)!, l.label, -1] as const),
      ]) { h = heightOf(from) + sign * verticalOf(label) * CONFIG.STOREY_HEIGHT; break; }
      if (h === undefined) continue;
      if (h) z.height = h;
      open.delete(id); changed = true;
    }
    // nothing settled yet (a story's first zones): the outdoor ones, else the first, stand at the ground
    if (!changed) { const seed = zones.find((z) => open.has(z.id) && z.outdoor) ?? zones.find((z) => open.has(z.id))!; open.delete(seed.id); }
  }
}
