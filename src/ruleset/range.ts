// Metres to zone links: the one conversion for every range written in metres while rules still count links (CO14).
import { CONFIG } from '../config';

/** metres one zone link stands for: LINK_PACES × PACE_M */
export const linkM = (): number => CONFIG.LINK_PACES * CONFIG.PACE_M;

/** the zone links a reach in metres covers: whole links only, so anything shorter than a link stays in the same zone (0) */
export const reachLinks = (metres: number): number => Math.floor(metres / linkM());
