// The Perks section draws every tree at once, one box per tree the character has a skill in, instead of one tree per tab.
import { describe, expect, it } from 'vitest';
import { treesOf } from '../../src/ui/perks';
import { makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { TREE_VIEW } from '../../src/ui/creation';

describe('Perks: a box per tree', () => {
  it('every tree the player has a skill in gets a box, in tree order, with only the skills they have', () => {
    const p = makeVillage().player, lib = getLibrary(), boxes = treesOf(p);
    const expected = TREE_VIEW.filter((t) => lib.trees[t.id]?.skills.some((k) => p.core.skills[k] !== undefined)).map((t) => t.id);
    expect(boxes.map((b) => b.id)).toEqual(expected);
    expect(boxes.length).toBeGreaterThan(1); // more than one tree shows at once
    for (const b of boxes) {
      expect(b.skills.length).toBeGreaterThan(0);
      for (const k of b.skills) expect(p.core.skills[k]).toBeDefined();
    }
  });
});
