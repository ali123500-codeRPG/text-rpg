// DX1-DX6 ("Essences: bested foes, extraction, balance"): taking the essence off someone (a small foreign addition to
// their Thread, never the Thread itself: NM2). A blessing of the god of essences (D-311; the perk PK.extract_essence,
// which the blessed Start grants) lets its owner, as their main action and within grip reach (DX3 a), take the essence
// of someone who is Down and has broken or surrendered (DX2 c). No roll decides whether it works; it uses up the
// target's one essence roll, so a later death gives none. The essence comes from the target's own list (DX4 b): it
// always appears, and its quality roll sets the grade but never fades it (below Success gives Common). It is worked out
// from the target's skills first (DX5), then the target is left Hollowed for good: it loses double the essence's share
// of true skill in each of the essence's skills, and HOLLOWED_ALL_LOSS of every skill. It counts as an attack (DX6 a;
// setAttackOverrides in resolve.ts): the target and bandmates who see it turn hostile, with no new fear. Only the player
// takes the offer, so only the player extracts for now.
import type { Actor, GameState, Rng } from '../types';
import { CONFIG } from '../config';
import { PK } from '../library/perkIds';
import { hasPerk } from '../ruleset/perks';
import { healthLevel } from '../ruleset/body';
import { moraleLevel } from '../ruleset/morale';
import { logCode } from './effects';
import { withinGrip } from './position';
import { gradeMult, measureOf, offerExtracted, qualityRoll, rowsFor } from './essence';

export type ExtractRefusal = 'no_power' | 'no_target' | 'not_helpless' | 'no_essence' | 'out_of_reach';

/** why `a` can't pull the essence out of `t` now, or null when it can */
export function cantExtract(state: GameState, a: Actor, t: Actor | undefined): ExtractRefusal | null {
  if (a !== state.player || !hasPerk(a, PK.extract_essence)) return 'no_power';
  if (!t || t === a || healthLevel(t) === 'dead') return 'no_target';
  if (healthLevel(t) !== 'incapacitated' || !(t.mind?.moraleState || moraleLevel(t) === 'broken')) return 'not_helpless';
  if (t.mind?.essenceRolled || !rowsFor(state, t).length) return 'no_essence';
  if (!withinGrip(state, a, t)) return 'out_of_reach';
  return null;
}

/** DX3-DX5: `a` pulls `t`'s essence out: an offer to `a` (source extract) and the Hollowed quirk on `t`. Returns the essence
 * row and the skills `t` lost, for the event and the Narrator */
export function extractEssence(state: GameState, a: Actor, t: Actor, rng: Rng): { essence: string; grade: string; lost: Record<string, number> } {
  t.mind!.essenceRolled = true;
  const rows = rowsFor(state, t), row = rows[Math.floor(rng.next() * rows.length)];
  const roll = qualityRoll(rng, CONFIG.ESSENCE_ROLL_BASE.foe, { state, actor: a }) ?? { grade: 'common' as const, past: 0 };
  offerExtracted(state, row, roll, t.names.current, measureOf(t)); // measured before the quirk takes anything
  const share = CONFIG.ESSENCE_SHARE * gradeMult(roll.grade, roll.past) * CONFIG.HOLLOWED_SHARE_MULT;
  const lost = Object.fromEntries(row.skills.map((s) => [s.skill, Math.min(1, share)]));
  t.core.hollowed = { skills: lost, all: CONFIG.HOLLOWED_ALL_LOSS };
  if (!hasPerk(t, PK.hollowed)) t.core.perks.push({ perkId: PK.hollowed, source: 'inflicted', gainedTurn: state.turn });
  logCode(state, 'essence_extracted', { actorId: a.id, target: t.id, essence: row.id, grade: roll.grade });
  return { essence: row.id, grade: roll.grade, lost };
}

