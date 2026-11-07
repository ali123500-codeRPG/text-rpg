import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { zoneById } from '../../src/engine/relations';

describe('83 Cover', () => {
  it('a ranged attack into a cover-2 zone adds +2 to the gap', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    zoneById(s, 'field_mid')!.cover = 2;
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: 'shortbow', equippedIn: ['hand:right_arm', 'hand:left_arm'] });
    const r = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'bow', targetPart: null, aimed: false }, s, forcedRng([100, 50, 50]));
    expect(r.gapShifts).toEqual([{ source: 'cover', value: 2 }]);
    expect(r.gap).toBe(r.defense!.tier - r.attack.tier + 2);
    // a melee attack takes no cover
    place(s, 'player', 'field_mid');
    s.player.core.inventory = s.player.core.inventory.filter((i) => i.id !== 'bow');
    s.player.core.inventory[0].equippedIn = ['hand:right_arm'];
    const m = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'player_arming_sword_1', targetPart: null, aimed: false }, s, forcedRng([100, 50, 50]));
    expect(m.gapShifts).toEqual([]);
  });
});
