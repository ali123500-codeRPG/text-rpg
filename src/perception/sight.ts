// How far an event is seen, worked out from real-world sight distances (CONFIG.SIGHT_M).
import { CONFIG } from '../config';
import { VISIBILITY, type VisibilityKey } from '../scales';

/** how well an event of this visibility is seen from `metres` away (seeingM): full out to its clear metres, partial out to
 * its glimpsed metres, else not at all */
export function sightLevel(visibility: VisibilityKey, metres: number | null): 'full' | 'partial' | null {
  const m = CONFIG.SIGHT_M[visibility];
  return !m || metres === null ? null : metres <= m[0] ? 'full' : metres <= m[1] ? 'partial' : null;
}

/** BG-252 (PG11 a): someone seen clearly who stays put stays seen clearly while they can still be glimpsed: as far as the
 * glimpse range of what they did, never less than a still figure's (the Low visibility level) */
export function stillGlimpsed(visibility: VisibilityKey, metres: number | null): boolean {
  return sightLevel(VISIBILITY.pos(visibility) > VISIBILITY.pos('low') ? visibility : 'low', metres) !== null;
}
