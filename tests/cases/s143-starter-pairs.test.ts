// Starter pairs: every gear class but improvised has a starter piece needing 25 and one needing 50; creation gives
// only the highest met per class, so any weapon focus starts with a weapon of its class.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { requirement } from '../../src/ruleset/requirements';
import { GC } from '../../src/library/tableIds';

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

});
