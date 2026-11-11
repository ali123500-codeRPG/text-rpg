import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { TIERS } from '../../src/scales';
import { CONFIG } from '../../src/config';

describe('37 Natural edge', () => {
  it('a natural 01 on the event roll lowers the tier by two, times EVENT_EDGE_SCALE', () => {
    const s = makeVillage();
    getLibrary().perks.blessed = { id: 'blessed', name: 'Blessed', eventRoll: 100 };
    s.player.core.perks.push({ perkId: 'blessed', source: 'level', gainedTurn: 0 });
    const six = ruleset.eventRoll(s.player, s, forcedRng([6])); // total 106: margin 56, Great Success, no edge
    const one = ruleset.eventRoll(s.player, s, forcedRng([1])); // total 101: Great Success band, then −2 × scale
    expect(six.tier).toBe('great_success');
    expect(TIERS.pos(one.tier)).toBe(Math.max(0, TIERS.pos('great_success') - 2 * CONFIG.EVENT_EDGE_SCALE));
    // clamped at the ends (event roll only)
    s.player.core.perks = [];
    expect(ruleset.eventRoll(s.player, s, forcedRng([1])).tier).toBe('critical_failure');
  });
});
