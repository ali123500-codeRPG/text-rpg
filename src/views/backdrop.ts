// PS-487: which backdrop the play screen shows for a zone. Code picks it; the screen only shows it (src/ui/backdrop.ts).
import type { GameState, Zone } from '../types';
import { BACKDROPS, ROAD } from '../library/backdrops';
import { regionAt } from '../land/sight';
import { middle, roofed } from '../plan/where';
import { now, timeOfDay } from '../time';

/** keep the narrowed list only when it leaves something to show */
const prefer = <T>(all: T[], keep: (x: T) => boolean): T[] => (all.some(keep) ? all.filter(keep) : all);
/** a steady number from a zone's id, so one zone keeps one picture and zones of one kind still differ */
const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** the picture id for a zone, or undefined for the plain page colour (a hand-built zone with no kind and no road) */
export function backdropFor(state: GameState, z: Zone): string | undefined {
  const kind = z.kind ?? (z.road ? ROAD : undefined);
  let pool = BACKDROPS.filter((b) => !!kind && b.kinds.includes(kind));
  if (!pool.length) return undefined;
  const dark = ['evening', 'night'].includes(timeOfDay(now(state)));
  pool = roofed(state, z) ? pool : prefer(pool, (b) => !!b.night === dark); // a moonlit scene only in the open after dark
  const region = regionAt(state, middle(z))?.kind;
  if (region) pool = prefer(pool, (b) => !!b.regions?.includes(region));
  return pool[hash(z.id) % pool.length].id;
}
/** the player's zone view with its backdrop, when it has one */
export function withBackdrop<V extends object>(state: GameState, z: Zone, v: V): V & { backdrop?: string } {
  const b = backdropFor(state, z);
  return b ? { ...v, backdrop: b } : v;
}
