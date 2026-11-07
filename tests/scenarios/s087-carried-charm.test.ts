import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

describe('87 Carried charm', () => {
  it('a carried charm naming the situation roll modifies it; one without never does', () => {
    const s = makeVillage();
    s.blueprints.push({ storyId: 'test', id: 'plain_charm', kind: 'item', data: {
      id: 'plain_charm', kind: 'misc', name: 'plain charm', look: 'a charm', bulk: 0, value: 1,
      effects: [{ kind: 'rollMod', roll: 'perception', value: 5, active: 'carried', scope: 'any' }] } });
    expect(ruleset.situation(s.player, s, forcedRng([47])).tier).toBe('Partial');
    s.player.core.inventory.push({ id: 'p1', itemId: 'plain_charm' });
    expect(ruleset.situation(s.player, s, forcedRng([47])).modifiers).toEqual([]);
    s.player.core.inventory.push({ id: 'c1', itemId: 'lucky_charm' }); // carried, not equipped
    const lucky = ruleset.situation(s.player, s, forcedRng([47]));
    expect(lucky.modifiers).toEqual([{ source: 'Gear (carried): lucky charm', type: 'gear', value: 5 }]);
    expect(lucky.tier).toBe('Success');
  });
});
