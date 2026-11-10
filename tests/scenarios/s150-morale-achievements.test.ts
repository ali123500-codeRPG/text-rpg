// 150 D-160 morale achievements: fights won while Panicking (1, 10, 25) and the scar for breaking (1, 5, 25).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { tally } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import type { GameState } from '../../src/types';

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key);

describe('150 morale achievements', () => {
  it('fights won while Panicking climb a chain at 1, 10 and 25', () => {
    const s = makeVillage();
    tally(s, 'won_panicking');
    expect(earned(s)).toContain(ACH.won_panicking_1);
    for (let i = 1; i < 10; i++) tally(s, 'won_panicking');
    expect(earned(s)).toContain(ACH.won_panicking_10);
    expect(earned(s)).not.toContain(ACH.won_panicking_1);
    for (let i = 10; i < 25; i++) tally(s, 'won_panicking');
    expect(earned(s)).toContain(ACH.won_panicking_25);
  });

  it('breaking is a scar from the first break, then at 5 and 25', () => {
    const s = makeVillage();
    const a = getLibrary().achievements!;
    expect([ACH.morale_breaks_1, ACH.morale_breaks_5, ACH.morale_breaks_25].map((id) => [a[id].count, a[id].level, a[id].scar]))
      .toEqual([[1, 'zero', true], [5, 'i', true], [25, 'ii', true]]);
    tally(s, 'morale_breaks');
    expect(earned(s)).toContain(ACH.morale_breaks_1);
    for (let i = 1; i < 5; i++) tally(s, 'morale_breaks');
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.morale_breaks_5]));
    expect(earned(s)).not.toContain(ACH.morale_breaks_1);
  });
});
