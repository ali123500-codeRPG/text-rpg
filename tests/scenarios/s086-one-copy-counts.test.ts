import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, situationMods } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';

describe('86 One copy counts', () => {
  it('two identical lucky charms give the same situation-roll modifier as one', () => {
    const s = makeVillage();
    s.player.core.inventory.push({ id: 'c1', itemId: IT.lucky_charm });
    const one = situationMods(s, s.player);
    const r1 = ruleset.situation(s.player, s, forcedRng([45]));
    s.player.core.inventory.push({ id: 'c2', itemId: IT.lucky_charm });
    expect(situationMods(s, s.player)).toEqual(one);
    expect(one).toHaveLength(1);
    const r2 = ruleset.situation(s.player, s, forcedRng([45]));
    expect(r2.tier).toBe(r1.tier);
    expect(r2.tier).toBe('success'); // 45 + 5
  });
});
