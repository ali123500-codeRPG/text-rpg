import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

describe('75 Attack floor', () => {
  it('a Failure misses with no defense roll', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    // slime: 10 + 0.5×30 + 10 (slam hit) − 63.5 = −28.5 → Failure
    const rng = forcedRng([10, 99]);
    const r = ruleset.attack({ attackerId: 'slime_1', targetId: 'player', weaponId: 'natural:slam', targetPart: null, aimed: false }, s, rng);
    expect(r.attack.tier).toBe('failure');
    expect(r.outcome).toBe('missed');
    expect(r.defense).toBeNull();
    expect(rng.queue).toEqual([99]); // no defense die used
    expect(ruleset.applyEffects(r, s)).toEqual([]);
  });
  it('a Near Miss shifted to Failure by a natural 02–05 also misses', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    // player: 5 + 0.5×(50 + 20 kit) − 63.5 = −23.5 → Near Miss, natural −1 → Failure
    const r = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'player_arming_sword_1', targetPart: null, aimed: false }, s, forcedRng([5]));
    expect(r.attack.tier).toBe('failure');
    expect(r.outcome).toBe('missed');
    expect(r.deciding.attack).toContain('fumble');
  });
});
