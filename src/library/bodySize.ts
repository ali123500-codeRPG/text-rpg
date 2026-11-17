// Body size (SZ1-SZ3, SZ8, SZ18): the one place sizes turn into an arm's reach and a volume. Sizes come from
// actorBody(...).size (body type × race), so anything that changes a size later (perks, SZ15) moves both at once.
import type { BodySize } from '../types';
import { CONFIG } from '../config';

/** SZ3: the Humanoid's size, in metres: a man in ANSUR II (2012 US Army survey): stature 1.76 m, shoulder breadth about
 * 0.5 m, chest depth about 0.25 m (0.3 clothed) */
export const HUMANOID_SIZE: BodySize = { lengthM: 0.3, widthM: 0.5, heightM: 1.75 };

/** SZ8: how far an arm reaches past the body's edge: half the arm span (fingertip to fingertip, ARM_SPAN_SHARE of the
 * height) less half the shoulders. A person 1.75 m tall and 0.5 m wide: (1.75 × 1 − 0.5) ÷ 2 = 0.625 m. */
export const armReachM = (s: BodySize): number => Math.max(0, (s.heightM * CONFIG.ARM_SPAN_SHARE - s.widthM) / 2);

/** SZ18: a body's volume in cubic metres, the box it fills: length × width × height (a person about 0.26 m³) */
export const volumeM3 = (s: BodySize): number => s.lengthM * s.widthM * s.heightM;

/** SZ11: the area of a body's outline from the viewer's eye, in m²: its longer floor side × (height × cos θ + shorter
 * side × sin θ), θ the look-down angle (0 on level ground: the side view; 90° straight down: the top) */
export function seenAreaM2(s: BodySize, lookDown = 0): number {
  const long = Math.max(s.lengthM, s.widthM), short = Math.min(s.lengthM, s.widthM);
  return long * (s.heightM * Math.cos(lookDown) + short * Math.sin(lookDown));
}

/** SZ11: how much farther a body is seen than a person: √(its seen area ÷ a person's from level ground) (Johnson's criteria:
 * the range a thing is made out at grows with its size across). No cap; the horizon caps it outdoors. */
export const sightFactor = (s: BodySize, lookDown = 0): number => Math.sqrt(seenAreaM2(s, lookDown) / seenAreaM2(HUMANOID_SIZE));

/** SZ12: cover steps a body gains from its height: one for each halving below a person's, one lost for each doubling above */
export const coverSteps = (s: BodySize): number => -Math.round(Math.log2(s.heightM / HUMANOID_SIZE.heightM));
