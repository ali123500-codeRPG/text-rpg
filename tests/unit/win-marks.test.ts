// Wins against stronger sides teach: a contest or defended attack the player wins has no top to its learning window
// (only the floor, MARK_WINDOW below raw, applies); a loss still needs the full window.
import { expect, it } from 'vitest';
import type { ContestResult } from '../../src/types';
import { makeVillage, actor } from '../harness';
import { markUse } from '../../src/ruleset/improve';
import { SK } from '../../src/library/skillIds';

it('a win against a far stronger side marks; a loss to it does not; either side can win', () => {
  const s = makeVillage(), p = s.player, t = actor(s, 'patron_1');
  p.core.skills[SK.dodge] = { raw: 20, state: 'normal' };
  t.core.skills[SK.dodge] = { raw: 60, state: 'normal' }; // far above the player's window (top 30)
  const roll = (actorId: string) => ({ actorId, skill: SK.dodge }) as ContestResult['a'];
  const contest = (gap: number, playerIsA: boolean): ContestResult =>
    ({ a: roll(playerIsA ? p.id : t.id), b: roll(playerIsA ? t.id : p.id), gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' });
  const marks = (r: ContestResult) => { p.progression!.marks = []; p.progression!.markCounts = {}; markUse(s, p, SK.dodge, r); return p.progression!.marks; };
  expect(marks(contest(-2, true))).toEqual([SK.dodge]); // the player is A and wins
  expect(marks(contest(2, false))).toEqual([SK.dodge]); // the player is B and wins
  expect(marks(contest(2, true))).toEqual([]); // a loss to a stronger side needs the window
  t.core.skills[SK.dodge] = { raw: 0, state: 'normal' };
  p.core.skills[SK.dodge] = { raw: 40, state: 'normal' };
  expect(marks(contest(-2, true))).toEqual([]); // a win against a far weaker side still teaches nothing
});
