import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { effectiveSkill, ruleset } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';

describe('85 Packed sword does nothing', () => {
  it('a stowed sword adds no skill bonus to a melee hit roll; drawn, it does', () => {
    const s = makeVillage();
    const sword = s.player.core.inventory.find((i) => i.itemId === 'arming_sword')!;
    const req = { actorId: 'player', skill: SK.melee_medium, modifiers: [], tierShifts: [], itemId: sword.id, rollKind: 'hit' as const };
    const drawn = ruleset.roll(req, s, forcedRng([50]));
    expect(effectiveSkill(s, s.player, SK.melee_medium, { itemId: sword.id }).value).toBe(75);
    delete sword.equippedIn;
    const packed = ruleset.roll(req, s, forcedRng([50]));
    expect(effectiveSkill(s, s.player, SK.melee_medium, { itemId: sword.id }).value).toBe(50);
    expect(drawn.margin - packed.margin).toBe(12.5); // +25 kit at the 0.5 skill weight
  });
});
