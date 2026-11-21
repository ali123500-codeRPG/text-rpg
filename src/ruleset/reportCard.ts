// TS1–TS3: the report card of a character whose story ended, shown on their Hall of fame entry. Three lines, each a
// rank of the one rank ladder (letters are a second name for its rows, GRADE_LETTERS); display only, it gives nothing.
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { GRADE_LETTERS, RANKS, type GradeKey, type RankKey } from '../scales';
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
/** the highest rank whose row the value reaches (rows rise without end, so this always stops); below E's row, the last
 * grade whose share of the way to E the value reaches (FFF, FF, F: GRADE_LOW_SHARE) */
function gradeOf(value: number, row: (r: RankKey) => number): RankKey | GradeKey {
  let pos = 0;
  while (row(rankAtPos(pos + 1)) <= value) pos++;
  if (pos) return rankAtPos(pos);
  const share = value / row(rankAtPos(1));
  return (Object.entries(CONFIG.GRADE_LOW_SHARE) as [GradeKey, number][]).filter(([, from]) => share >= from).at(-1)?.[0] ?? 'grade_fff';
}
/** TS2: a grade's letter; past the last row the last letter gains a + per step (MAX+, MAX++) */
export const gradeLetter = (rank: string): string => (rank in GRADE_LETTERS ? GRADE_LETTERS[rank as GradeKey] : GRADE_LETTERS[RANKS.keys[LAST]] + '+'.repeat(rankPos(rank as RankKey) - LAST));

/** Combat Power: the best fighting true skill (Melee, Ranged, Defense); the report card reads it against the rank anchors */
export function combatPower(a: Actor): number {
  const lib = getLibrary();
  return Math.max(0, ...Object.keys(a.core.skills).filter((id) => FIGHTING.has(groupsOf(lib.skills[id])[0])).map((id) => trueSkill(a, id)));
}
/** GW1 a: one of the Great, past the mortal limit: Combat Power at CONFIG.GREAT_FROM's anchor or higher, for NPCs and the hero alike */
export const isGreat = (a: Actor): boolean => combatPower(a) >= rankRow(CONFIG.GREAT_FROM).anchor;

/** Combat Power: the best fighting skill (Melee, Ranged, Defense) against the rank anchors, as an NPC's rank is read.
 * Achievements: all achievement XP earned. Reputation: how many people know the hero's name. */
export function reportCard(s: GameState): { combat: RankKey | GradeKey; achievements: RankKey | GradeKey; reputation: RankKey | GradeKey } {
  const lib = getLibrary(), p = s.player;
  const best = combatPower(p);
  const xp = (p.progression?.achievements ?? []).reduce((n, a) => { const d = lib.achievements?.[a.key ?? '']; return n + (d ? achXp(d, a.of) : 0); }, 0);
  const known = s.actors.filter((a) => knowsName(s, a, p)).length;
  return { combat: gradeOf(best, (r) => rankRow(r).anchor), achievements: gradeOf(xp, rowOf(CONFIG.GRADE_ACH_XP)), reputation: gradeOf(known, rowOf(CONFIG.GRADE_KNOWN_BY)) };
}
