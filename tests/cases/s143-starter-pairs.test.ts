// Starter pairs: every gear class but improvised has a starter piece needing 25 and one needing 50; creation gives
// only the highest met per class, so any weapon focus starts with a weapon of its class.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { createPlayer, recommendedBuild, starterKit } from '../../src/library/spawn';
import { requirement } from '../../src/ruleset/requirements';
import { GC } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

describe('143 starter pairs', () => {
  it('every gear class but improvised has starter items needing 25 and 50, and none above 50', () => {
    const L = getLibrary();
    for (const gc of Object.values(GC)) {
      if (gc === GC.improvised) continue;
      const needs = Object.values(L.items).filter((i) => i.gearClass === gc && i.tags?.includes('starter')).map((i) => requirement(i)!.need);
      expect(needs, L.gearClasses![gc].name).toContain(25);
      expect(needs, L.gearClasses![gc].name).toContain(50);
      expect(Math.max(...needs), L.gearClasses![gc].name).toBeLessThanOrEqual(50);
    }
  });

  it('a heavy-weapons build starts holding a heavy weapon: the Fine one at 50, the Common one at 25', () => {
    const held = (heavy: number) => {
      const p = createPlayer(recommendedBuild(), 's1');
      p.core.skills = { ...p.core.skills, [SK.melee_medium]: { raw: 0, state: 'normal' }, [SK.melee_heavy]: { raw: heavy, state: 'normal' } };
      return starterKit(p).filter((i) => getLibrary().items[i.itemId].gearClass === GC.melee_heavy).map((i) => [i.itemId, i.equippedIn?.length ?? 0]);
    };
    expect(held(50)).toEqual([[IT.greatsword, 2]]);
    expect(held(25)).toEqual([[IT.woodsman_axe, 2]]);
  });
});
