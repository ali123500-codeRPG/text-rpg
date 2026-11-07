import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, tierIndexOf } from '../../src/ruleset';
import { getLibrary } from '../../src/library';

describe('37 Natural edge', () => {
  it('a natural 01 on the situation roll lowers the tier by two', () => {
    const s = makeVillage();
    getLibrary().perks.blessed = { id: 'blessed', name: 'Blessed', situation: 60 };
    s.player.core.perks.push({ perkId: 'blessed', source: 'level', gainedTurn: 0 });
    const six = ruleset.situation(s.player, s, forcedRng([6])); // total 66: Success, no edge
    const one = ruleset.situation(s.player, s, forcedRng([1])); // total 61: Success band, then −2
    expect(six.tier).toBe('Success');
    expect(tierIndexOf(one.tier)).toBe(tierIndexOf('Success') - 2);
    expect(one.tier).toBe('Failure');
    // clamped at the ends (situation roll only)
    s.player.core.perks = [];
    expect(ruleset.situation(s.player, s, forcedRng([1])).tier).toBe('Critical Failure');
  });
});
