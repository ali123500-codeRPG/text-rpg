// CS7: what counts as a hit, read from the one hit-outcomes table (src/scales.ts HIT_OUTCOMES) by position.
import { HIT_OUTCOMES, type HitOutcome } from '../scales';

const at = (o: HitOutcome, from: HitOutcome) => HIT_OUTCOMES.pos(o) >= HIT_OUTCOMES.pos(from);
/** the blow reached the body (Grazed or worse): hit flashes, aimed-hit and contest feats */
export const struck = (o: HitOutcome): boolean => at(o, 'grazed');
/** the blow connected with the body or a shield (Blocked or past): Hold, One-Two, Volley, perk marks, who last hit someone */
export const met = (o: HitOutcome): boolean => at(o, 'blocked');
/** a defense stopped it short of the body: dodged, parried or blocked */
export const defended = (o: HitOutcome): boolean => at(o, 'dodged') && !struck(o);
/** an outcome as story text and check lines say it ("full hit") */
export const outcomeText = (o: HitOutcome): string => HIT_OUTCOMES.name(o).toLowerCase();
