import { IT } from '../../src/library/itemIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

// player 50 → Success (0); patron dodge 0: 30 − 63.5 = −33.5 → Failure (-2): gap −2
const req = { attackerId: 'player', targetId: 'patron_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: 'left_leg', aimed: false };
describe('79 Named part', () => {
  it('at gap −2 a hit rolled on the general area moves to the named left leg', () => {
    const s = makeVillage();
    const r = ruleset.attack(req, s, forcedRng([50, 30, 80]));
    expect(r.gap).toBe(-2);
    expect(r.location).toBe('left_leg');
    expect(r.locationHow).toBe('redirected');
  });
  it('one rolled on an arm stays', () => {
    const s = makeVillage();
    const r = ruleset.attack(req, s, forcedRng([50, 30, 20]));
    expect(r.gap).toBe(-2);
    expect(r.location).toBe('left_arm');
    expect(r.locationHow).toBe('rolled');
  });
});
