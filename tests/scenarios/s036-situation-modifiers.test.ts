import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { getLibrary } from '../../src/library';

describe('36 Situation modifiers', () => {
  it('a perk naming the event roll changes it; Wounded and terrain do not', () => {
    const s = makeVillage();
    const base = ruleset.eventRoll(s.player, s, forcedRng([60]));
    expect(base.tier).toBe('success'); // total 60

    getLibrary().perks.lucky_star = { id: 'lucky_star', name: 'Lucky star', eventRoll: 20 };
    s.player.core.perks.push({ perkId: 'lucky_star', source: 'level', gainedTurn: 0 });
    const perk = ruleset.eventRoll(s.player, s, forcedRng([60]));
    expect(perk.modifiers).toEqual([{ source: 'Lucky star', type: 'perk', value: 20 }]);
    expect(perk.tier).toBe('great_success'); // total 80
    s.player.core.perks = [];

    s.player.core.condition.hpLostPct = 50; // Wounded
    for (const z of s.zones) { z.cover = 'heavy'; z.light = 'dark'; } // terrain
    const hurt = ruleset.eventRoll(s.player, s, forcedRng([60]));
    expect(hurt.modifiers).toEqual([]);
    expect(hurt.tier).toBe(base.tier);
  });
});
