// How far an event is seen, worked out from real-world sight distances (CONFIG.SIGHT_M).
import { CONFIG } from '../config';
import type { VisibilityKey } from '../scales';
import { reachLinks } from '../ruleset/range';

/** how well an event of this visibility is seen from `metres` away (seeingM): full out to its clear metres, partial out to
 * its glimpsed metres, else not at all */
export function sightLevel(visibility: VisibilityKey, metres: number | null): 'full' | 'partial' | null {
  const m = CONFIG.SIGHT_M[visibility];
  return !m || metres === null ? null : metres <= m[0] ? 'full' : metres <= m[1] ? 'partial' : null;
}

/** the zone links an event of this visibility is seen, [full, partial] (−1 = nowhere): each grade's metres turned into
 * links by reachLinks; under SAME_ZONE_M is nowhere, so a level too small to make out at arm's length stays partial. */
export function sightReach(visibility: VisibilityKey): [number, number] {
  const m = CONFIG.SIGHT_M[visibility];
  const far = (metres: number) => (metres < CONFIG.SAME_ZONE_M ? -1 : reachLinks(metres));
  return m ? [far(m[0]), far(m[1])] : [-1, -1];
}
