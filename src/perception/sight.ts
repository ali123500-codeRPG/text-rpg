// How far an event is seen, worked out from real-world sight distances (CONFIG.SIGHT_M).
import { CONFIG } from '../config';
import type { VisibilityKey } from '../scales';

/** how well an event of this visibility is seen from `metres` away (seeingM): full out to its clear metres, partial out to
 * its glimpsed metres, else not at all */
export function sightLevel(visibility: VisibilityKey, metres: number | null): 'full' | 'partial' | null {
  const m = CONFIG.SIGHT_M[visibility];
  return !m || metres === null ? null : metres <= m[0] ? 'full' : metres <= m[1] ? 'partial' : null;
}
