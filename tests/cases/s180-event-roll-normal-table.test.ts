import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { TIERS } from '../../src/scales';

// ER3: the event roll reads the normal roll table, so only a natural roll reaches a critical tier unless modifiers are big.
// 37 Natural edge (merged here): a natural 01 on the event roll lowers the tier by one, never two.
describe('180 Event roll on the normal roll table', () => {
  it('odds 5 / 19 / 25 / 25 / 21 / 5 with no modifier; a ±10/15 modifier never reaches a critical tier; a natural 01 lowers the tier by one', () => {
    const s = makeVillage();
    const tierFor = (d: number, v = 0) => {
      getLibrary().perks.er3_luck = { id: 'er3_luck', name: 'Luck', eventRoll: v };
      s.player.core.perks = v ? [{ perkId: 'er3_luck', source: 'level', gainedTurn: 0 }] : [];
      return ruleset.eventRoll(s.player, s, forcedRng([d])).tier;
    };
    const count = Object.fromEntries(TIERS.keys.map((k) => [k, 0]));
    for (let d = 1; d <= 100; d++) count[tierFor(d)]++;
    expect(TIERS.keys.map((k) => count[k])).toEqual([5, 19, 25, 25, 21, 5]);
    expect(tierFor(90)).toBe('great_success');
    expect(tierFor(96)).toBe('critical_success');
    expect(tierFor(5)).toBe('critical_failure'); // clamped at the ends (event roll only)
    expect(tierFor(1)).toBe('critical_failure');
    expect(tierFor(95, 10)).toBe('great_success'); // only a natural 96+ reaches Critical Success
    expect(tierFor(6, -15)).toBe('failure'); // only a natural 05 or lower reaches Critical Failure
    expect(tierFor(6, 60)).toBe('success'); // total 66: Success, no edge
    expect(tierFor(1, 60)).toBe('near_miss'); // total 61: Success band, then −1
  });
});
