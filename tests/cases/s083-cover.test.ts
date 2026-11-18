import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { zoneById } from '../../src/engine/relations';
import { IT } from '../../src/library/itemIds';

describe('83 Cover', () => {
  it('CV6: a ranged attack takes −10 for each halving of what shows of the target: a 0.3 m slime in heavy cover shows 4%', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    zoneById(s, 'field_mid')!.cover = 'heavy';
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    const r = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'bow', targetPart: null, aimed: false }, s, forcedRng([100, 50, 50]));
    expect(r.attack.modifiers).toContainEqual({ source: 'cover', type: 'situational', value: -45 }); // 0.25 × 0.3 ÷ 1.75 shows
    expect(r.gapShifts).toEqual([]); // no longer a gap shift
    // a melee attack takes no cover
    place(s, 'player', 'field_mid');
    s.player.core.inventory = s.player.core.inventory.filter((i) => i.id !== 'bow');
    s.player.core.inventory[0].equippedIn = ['grip:right_arm'];
    const m = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false }, s, forcedRng([100, 50, 50]));
    expect(m.attack.modifiers.some((x) => x.source === 'cover')).toBe(false);
  });
});
