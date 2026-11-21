// 36 Situation modifiers, 86 One copy counts, 87 Carried charm: only what names the event roll changes it.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, eventRollMods } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { setTitleLight } from '../../src/plan/draw';
import { LC } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { landUnder } from '../harness';

describe('36 Situation modifiers', () => {
  it('a perk or a carried charm naming the event roll changes it, one copy counting once; Wounded, terrain and a charm naming another roll do not', () => {
    const s = makeVillage();
    const roll = (d: number) => ruleset.eventRoll(s.player, s, forcedRng([d]));
    const base = roll(60);
    expect(base.tier).toBe('success'); // total 60

    getLibrary().perks.lucky_star = { id: 'lucky_star', name: 'Lucky star', eventRoll: 20 };
    s.player.core.perks.push({ perkId: 'lucky_star', source: 'level', gainedTurn: 0 });
    const perk = roll(60);
    expect(perk.modifiers).toEqual([{ source: 'Lucky star', type: 'perk', value: 20 }]);
    expect(perk.tier).toBe('great_success'); // total 80
    s.player.core.perks = [];

    s.player.core.condition.hpLostPct = 50; // Wounded
    for (const z of s.zones) { landUnder(s, z.outline, LC.woods); setTitleLight(s, z, 'dark'); } // terrain
    const hurt = roll(60);
    expect(hurt.modifiers).toEqual([]);
    expect(hurt.tier).toBe(base.tier);

    s.blueprints.push({ storyId: 'test', id: 'plain_charm', kind: 'item', data: {
      id: 'plain_charm', kind: 'misc', name: 'plain charm', look: 'a charm', bulk: 0, value: 1,
      effects: [{ kind: 'rollMod', roll: 'perception', value: 5, active: 'carried', scope: 'any' }] } });
    s.player.core.inventory.push({ id: 'p1', itemId: 'plain_charm' });
    expect(roll(47)).toMatchObject({ modifiers: [], tier: 'near_miss' });
    s.player.core.inventory.push({ id: 'c1', itemId: IT.lucky_charm }); // carried, not equipped
    const lucky = roll(47);
    expect(lucky.modifiers).toEqual([{ source: 'Gear (carried): lucky charm', type: 'gear', value: 5 }]);
    expect(lucky.tier).toBe('success');
    const one = eventRollMods(s, s.player);
    s.player.core.inventory.push({ id: 'c2', itemId: IT.lucky_charm });
    expect(eventRollMods(s, s.player)).toEqual(one);
    expect(roll(47).modifiers).toEqual(lucky.modifiers);
  });
});
