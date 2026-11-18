// PZ5 a (D-391): light at a point is the brightest of the sky (where no roof is overhead, by the time of day) and each lit
// source with a clear line to it, at brightness ÷ metres² (the inverse-square law), read as the brightest LIGHT_LUX level
// it reaches.
import type { GameState, Light, Pt, Zone } from '../types';
import { CONFIG } from '../config';
import { LIGHT } from '../scales';
import { now, timeOfDay } from '../time';
import { lineClear } from './line';
import { middle, underRoof } from './where';
import { keepInside } from './geom';

/** the sky's light in lux now (CONFIG.SKY_LIGHT by time of day) */
export const skyLux = (state: GameState): number => CONFIG.LIGHT_LUX[CONFIG.SKY_LIGHT[timeOfDay(now(state))]] ?? 0;
/** the light level a lux reading reaches: the brightest LIGHT key whose lux it meets (pitch black below the darkest lit) */
export function lightOfLux(lux: number): Light {
  for (const k of LIGHT.keys) if (lux >= (CONFIG.LIGHT_LUX[k] ?? 0) - 1e-12 && (CONFIG.LIGHT_LUX[k] ?? 0) > 0) return k as Light;
  return 'black';
}
/** PZ5 a: the lux at a point `h` metres above the ground outside on a floor: the sky (no roof overhead) or the brightest
 * source in a clear line, whichever is more */
export function luxAt(state: GameState, p: Pt, floor: number, h = floor + 1): number {
  let lux = underRoof(state, p, floor) ? 0 : skyLux(state);
  for (const s of state.lights) {
    if (s.lit === false) continue;
    const d2 = (s.at.x - p.x) ** 2 + (s.at.y - p.y) ** 2 + (s.h - h) ** 2;
    const l = s.candela / Math.max(d2, 0.25); // never nearer than half a metre
    if (l <= lux) continue;
    if (lineClear(state, { ...s.at, z: s.h }, { ...p, z: h })) lux = l;
  }
  return lux;
}
/** PZ5 a: the light level at a point on a floor */
export const lightAt = (state: GameState, p: Pt, floor: number, h?: number): Light => lightOfLux(luxAt(state, p, floor, h));
/** PZ5: the light in a title: at point `p` in it (where someone stands), else at its middle; bright when it has no
 * footprint */
export function zoneLight(state: GameState, z: Zone | undefined, p?: Pt): Light {
  if (!z?.outline?.length) return 'bright';
  return lightAt(state, p ?? keepInside(middle(z), z.outline, 0), z.floor);
}
