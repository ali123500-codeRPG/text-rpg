import { AM } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, place, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';

describe('16 Same roll code', () => {
  it('player and NPC attacks pass through ruleset.attack and ruleset.roll', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    const roll = vi.spyOn(ruleset, 'roll');
    const rng = createRng(3);
    ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false }, s, rng);
    ruleset.attack({ attackerId: 'slime_1', targetId: 'player', weaponId: `natural:${AM.slam}`, targetPart: null, aimed: false }, s, rng);
    const hits = roll.mock.calls.filter((c) => c[0].rollKind === 'hit').map((c) => c[0].actorId);
    expect(hits).toEqual(['player', 'slime_1']);
    roll.mockRestore();
  });
});
