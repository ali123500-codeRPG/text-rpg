// BG-267, IC7 a: the weapon a blow uses is picked with the one reach check (withinM), which allows CONFIG.REACH_MARGIN_M
// (0.1 m) past the reach, so a fighter a step's rounding past the sword's reach still strikes with the sword.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { defaultMode } from '../../src/ruleset/gear';
import { CONFIG } from '../../src/config';

describe('341 reach margin', () => {
  it('a sword fighter just past the reach, within the margin, gets the sword', () => {
    const s = makeVillage(), p = s.player;
    const sword = defaultMode(s, p, 0)!;
    expect(defaultMode(s, p, sword.mode.reach + CONFIG.REACH_MARGIN_M / 2)?.itemId).toBe(sword.itemId);
  });
});
