// TS1–TS3: the report card of a character whose story ended, shown on their Hall of fame entry. Three lines, each a
// rank of the one rank ladder (letters are a second name for its rows, GRADE_LETTERS); display only, it gives nothing.
import type { GameState } from '../types';
import { CONFIG } from '../config';
import { GRADE_LETTERS, RANKS, type RankKey } from '../scales';
import { getLibrary } from '../library';
import { GR } from '../library/functionIds';
import { groupsOf } from '../library/functionNames';
import { rankAtPos, rankPos, rankRow } from '../library/spawn';
import { knowsName } from '../engine/relations';
import { trueSkill } from './perks';
import { achXp } from './achRewards';

const LAST = RANKS.keys.length - 1;
const FIGHTING = new Set<string>([GR.melee, GR.ranged, GR.defense]);
/** a grade table's row for a rank; past the last row each step multiplies it by GRADE_BEYOND_MULT */
const rowOf = (table: Record<string, number>) => (r: RankKey) => (RANKS.has(r) ? table[r] : table[RANKS.keys[LAST]] * CONFIG.GRADE_BEYOND_MULT ** (rankPos(r) - LAST));
/** the highest rank whose row the value reaches (rows rise without end, so this always stops) */
function gradeOf(value: number, row: (r: RankKey) => number): RankKey {
  let pos = 0;
  while (row(rankAtPos(pos + 1)) <= value) pos++;
  return rankAtPos(pos);
}
/** TS2: a rank's letter; past the last row the last letter gains a + per step (MAX+, MAX++) */
export const gradeLetter = (rank: string): string => (RANKS.has(rank) ? GRADE_LETTERS[rank] : GRADE_LETTERS[RANKS.keys[LAST]] + '+'.repeat(rankPos(rank as RankKey) - LAST));

/** Combat Power: the best fighting skill (Melee, Ranged, Defense) against the rank anchors, as an NPC's rank is read.
 * Achievements: all achievement XP earned. Reputation: how many people know the hero's name. */
export function reportCard(s: GameState): { combat: RankKey; achievements: RankKey; reputation: RankKey } {
  const lib = getLibrary(), p = s.player;
  const best = Math.max(0, ...Object.keys(p.core.skills).filter((id) => FIGHTING.has(groupsOf(lib.skills[id])[0])).map((id) => trueSkill(p, id)));
  const xp = (p.progression?.achievements ?? []).reduce((n, a) => { const d = lib.achievements?.[a.key ?? '']; return n + (d ? achXp(d, a.of) : 0); }, 0);
  const known = s.actors.filter((a) => knowsName(s, a, p)).length;
  return { combat: gradeOf(best, (r) => rankRow(r).anchor), achievements: gradeOf(xp, rowOf(CONFIG.GRADE_ACH_XP)), reputation: gradeOf(known, rowOf(CONFIG.GRADE_KNOWN_BY)) };
}
