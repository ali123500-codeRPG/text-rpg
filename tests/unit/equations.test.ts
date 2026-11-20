// The Equations tab is built from equations(); it must build from the live library and CONFIG without throwing.
import { describe, expect, it } from 'vitest';
import { equations } from '../../src/ruleset/equations';
import { prototypeLibrary } from '../../src/library/data';

describe('equations for the library viewer', () => {
  it('builds every group with numbers from CONFIG', () => {
    const groups = equations(prototypeLibrary());
    for (const g of groups) for (const e of g.equations) {
      expect(e.formula).not.toMatch(/undefined|NaN/);
      for (const r of e.table?.rows ?? []) expect(r.join(' ')).not.toMatch(/undefined|NaN/);
    }
  });


});
