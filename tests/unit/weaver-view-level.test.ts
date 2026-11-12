// BG-75: the Weaver's view gave the player's level as the sum of class levels only, leaving out bonus levels; it now
// reads charLevel, the one character-level rule.
import { describe, expect, it } from 'vitest';
import { buildWeaverView } from '../../src/views';
import { charLevel } from '../../src/engine/xp';
import { makeVillage } from '../harness';

describe('the Weaver sees the player at their character level', () => {
  it('counts bonus levels', () => {
    const s = makeVillage();
    s.player.progression = { ...s.player.progression!, bonusLevelsTaken: 2 };
    const v = buildWeaverView(s, { kind: 'scenario', placeId: s.player.placeId });
    expect(v.player.level).toBe(charLevel(s.player));
    expect(v.player.level).toBe(s.player.core.classes.reduce((n, c) => n + c.level, 0) + 2);
  });
});
