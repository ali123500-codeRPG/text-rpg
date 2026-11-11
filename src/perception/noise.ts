// How far a sound carries, worked out from its decibels (the real-reference loudness of each NOISE level).
import { CONFIG } from '../config';
import type { NoiseKey } from '../scales';
import { linkM as linkMetres } from '../ruleset/range';

/** the zone links a sound of this noise carries, [clear, heard] (−1 = nowhere). One equation for every level: the level's
 * decibels at 1 m (CONFIG.NOISE_DB) less 20·log10(metres) (the inverse-square law) and LINK_SOUND_LOSS_DB per link crossed,
 * against HEAR_DB and CLEAR_HEAR_DB. Same zone is SAME_ZONE_M away; n links are n × LINK_PACES × PACE_M metres.
 * keenDb: a listener who hears that many dB quieter (Keen Ear's hearingDb) gets the sound that much louder; silence stays silent. */
export function noiseReach(noise: NoiseKey, keenDb = 0): [number, number] {
  const base = CONFIG.NOISE_DB[noise];
  const db = base === null ? null : base + keenDb;
  const linkM = linkMetres();
  const at = (n: number) => (db ?? -Infinity) - 20 * Math.log10(n === 0 ? CONFIG.SAME_ZONE_M : n * linkM) - CONFIG.LINK_SOUND_LOSS_DB * n;
  const far = (min: number) => { let n = -1; while (n < 50 && at(n + 1) >= min) n++; return n; };
  return [far(CONFIG.CLEAR_HEAR_DB), far(CONFIG.HEAR_DB)];
}
