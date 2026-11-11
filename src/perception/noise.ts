// How far a sound carries, worked out from its decibels (the real-reference loudness of each NOISE level).
import { CONFIG } from '../config';
import type { NoiseKey } from '../scales';

/** the zone links a sound of this noise carries, [clear, heard] (−1 = nowhere). One equation for every level: the level's
 * decibels at 1 m (CONFIG.NOISE_DB) less 20·log10(metres) (the inverse-square law) and LINK_SOUND_LOSS_DB per link crossed,
 * against HEAR_DB and CLEAR_HEAR_DB. Same zone is SAME_ZONE_M away; n links are n × LINK_PACES × PACE_M metres. */
export function noiseReach(noise: NoiseKey): [number, number] {
  const db = CONFIG.NOISE_DB[noise];
  const linkM = CONFIG.LINK_PACES * CONFIG.PACE_M;
  const at = (n: number) => (db ?? -Infinity) - 20 * Math.log10(n === 0 ? CONFIG.SAME_ZONE_M : n * linkM) - CONFIG.LINK_SOUND_LOSS_DB * n;
  const far = (min: number) => { let n = -1; while (n < 50 && at(n + 1) >= min) n++; return n; };
  return [far(CONFIG.CLEAR_HEAR_DB), far(CONFIG.HEAR_DB)];
}
