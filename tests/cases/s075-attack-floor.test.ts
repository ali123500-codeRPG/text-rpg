import { AM } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

// 16 Same roll code: player and NPC attacks roll their hit through ruleset.roll
const hitRollers = (spy: { mock: { calls: Parameters<typeof ruleset.roll>[] } }) => spy.mock.calls.filter((c) => c[0].rollKind === 'hit').map((c) => c[0].actorId);
afterEach(() => vi.restoreAllMocks());

describe('75 Attack floor', () => {
  it('a Failure misses with no defense roll', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    // slime: 10 + 0.5×30 + 10 (slam hit) − 63.5 = −28.5 → Failure
    const rng = forcedRng([10, 99]);
    const roll = vi.spyOn(ruleset, 'roll');
    const r = ruleset.attack({ attackerId: 'slime_1', targetId: 'player', weaponId: `natural:${AM.slam}`, targetPart: null, aimed: false }, s, rng);
    expect(r.attack.tier).toBe('failure');
    expect(r.outcome).toBe('missed');
    expect(r.defense).toBeNull();
    expect(rng.queue).toEqual([99]); // no defense die used
    expect(ruleset.applyEffects(r, s)).toEqual([]);
    expect(hitRollers(roll)).toEqual(['slime_1']);
  });
  it('a Near Miss shifted to Failure by a natural 02–05 also misses', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    // player: 5 + 0.5×(50 + 20 kit) − 63.5 = −23.5 → Near Miss, natural −1 → Failure
    const roll = vi.spyOn(ruleset, 'roll');
    const r = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false }, s, forcedRng([5]));
    expect(r.attack.tier).toBe('failure');
    expect(r.outcome).toBe('missed');
    expect(r.deciding.attack).toContain('fumble');
    expect(hitRollers(roll)).toEqual(['player']);
  });
});
