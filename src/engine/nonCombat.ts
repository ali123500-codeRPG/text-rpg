// PLACEHOLDER: the XP rating's non-combat part (GR34, GR41, GR42). Each non-combat skill group adds its pool (the worths
// of its skills, highest first at 1, ½, ¼…, as a group rating pools them) × its share: the part of an equal fight its use
// settles or saves, worked out from the rolls against a foe at the group's own rating (GR41: an equal foe, so skill counts
// once, through the pool). Checks pool skill lines only (GR43). The combat level reads the skills a fight uses; these
// groups count here; Intimidation counts here only, since the combat level leaves threats out.
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { GR } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { trueSkill } from '../ruleset/perks';
import { gradeMod } from '../ruleset';
import { expectOver, tierOdds } from '../ruleset/expect';
import { ratingOfGroups, ratingOf } from '../ruleset/ratings';
import { refFighter } from './combatLevel';
import { healShare } from '../ruleset/body';

/** how each non-combat group's share is worked out (CONFIG.NONCOMBAT_SHARES):
 * slip: its roll beats an equal watcher's outright (sneaking past, filching unseen: a tie only makes them suspicious);
 * catch: an equal sneaker does not beat its roll (the other side of slip);
 * talk_down: it wins by the tiers that convince a code-run foe to stand down (CONFIG.OFFER_WIN_TIERS);
 * heal: the share of missing health one Heal gives back on a roll graded at its own level, none below HEAL_UNLOCK */
export type ShareRule = 'slip' | 'catch' | 'talk_down' | 'heal';

/** one group's non-combat part: its pool (skill-point worths), its rating, its share and what it adds (pool × share) */
export type NonCombatGroup = { group: string; rule: ShareRule; pool: number; rating: number; share: number; adds: number };

/** the chance of each tier level on a plain roll of `skill` at `value` by `a` (no modifiers: an even contest or task) */
const plainOdds = (a: Actor, skill: string, value: number) => tierOdds({ actor: a, eff: { skill, value }, modifiers: [], shifts: [], reach: { up: 0, down: 0 } });
/** P(a's roll beats b's by at least `by` tiers) */
function pBeats(x: Map<number, number>, y: Map<number, number>, by: number): number {
  let p = 0;
  for (const [lx, px] of x) for (const [ly, py] of y) if (lx - ly >= by) p += px * py;
  return p;
}

/** a group's share at rating s (GR41: the foe is at s too) */
export function shareAt(state: GameState, a: Actor, group: string, rule: ShareRule, s: number): number {
  const foe = refFighter(state, 0, '__equal').ref; // a bare foe: no perks of its own
  const skill = { [GR.stealth]: SK.sneaking, [GR.notice]: SK.eyesight, [GR.sleight]: SK.filching, [GR.influence]: SK.persuasion, [GR.medicine]: SK.healing }[group] ?? SK.sneaking;
  if (rule === 'heal') return trueSkill(a, SK.healing) < CONFIG.HEAL_UNLOCK ? 0 : expectOver(plainOdds(a, skill, s + gradeMod(s) / CONFIG.SKILL_WEIGHT), healShare) // SE23: a task graded at its own level;
  const mine = plainOdds(a, skill, s), theirs = plainOdds(foe, skill, s);
  if (rule === 'slip') return pBeats(mine, theirs, 1);
  if (rule === 'catch') return 1 - pBeats(theirs, mine, 1);
  return pBeats(mine, theirs, CONFIG.OFFER_WIN_TIERS);
}

/** GR34: the non-combat part, group by group (CONFIG.NONCOMBAT_SHARES); groups with nothing in them are left out */
export function nonCombatGroups(state: GameState, a: Actor): NonCombatGroup[] {
  return Object.entries(CONFIG.NONCOMBAT_SHARES).flatMap(([group, rule]) => {
    const r = ratingOfGroups(state, a, [group]);
    const pool = r.parts.reduce((n, p) => n + p.adds, 0);
    if (!(pool > 0)) return [];
    const rating = ratingOf(pool), share = shareAt(state, a, group, rule, rating);
    return [{ group, rule, pool, rating, share, adds: pool * share }];
  });
}
export const nonCombatPart = (state: GameState, a: Actor): number => nonCombatGroups(state, a).reduce((n, g) => n + g.adds, 0);
