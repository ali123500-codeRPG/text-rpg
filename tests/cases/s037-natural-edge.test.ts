import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { naturalEdge, ruleset } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';

describe('37 Natural edge', () => {
  it('a natural 01 on the event roll lowers the tier by one, never two', () => {
    const s = makeVillage();
    getLibrary().perks.blessed = { id: 'blessed', name: 'Blessed', eventRoll: 60 };
    s.player.core.perks.push({ perkId: 'blessed', source: 'level', gainedTurn: 0 });
    const six = ruleset.eventRoll(s.player, s, forcedRng([6])); // total 66: Success, no edge
    const one = ruleset.eventRoll(s.player, s, forcedRng([1])); // total 61: Success band, then −1
    expect(six.tier).toBe('success');
    expect(one.tier).toBe('near_miss');
    // clamped at the ends (event roll only)
    s.player.core.perks = [];
    expect(ruleset.eventRoll(s.player, s, forcedRng([1])).tier).toBe('critical_failure');
  });
  it('every natural edge is one tier: the lowest and highest NATURAL_EDGE results only', () => {
    for (let d = 1; d <= 100; d++) {
      expect(naturalEdge(d)).toBe(d <= CONFIG.NATURAL_EDGE ? -1 : d > 100 - CONFIG.NATURAL_EDGE ? 1 : 0);
    }
  });
});
