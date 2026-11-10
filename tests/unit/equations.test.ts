// The Equations tab is built from equations(); it must build from the live library and CONFIG without throwing.
import { describe, expect, it } from 'vitest';
import { EFF_EX, effExample, equations } from '../../src/ruleset/equations';
import { effectiveSkill } from '../../src/ruleset/gear';
import { getLibrary } from '../../src/library';
import { makeVillage } from '../harness';
import { prototypeLibrary } from '../../src/library/data';

describe('equations for the library viewer', () => {
  it('builds every group with numbers from CONFIG', () => {
    const groups = equations(prototypeLibrary());
    expect(groups.map((g) => g.key)).toEqual(['rolls', 'attacks', 'gain', 'marking']);
    for (const g of groups) for (const e of g.equations) {
      expect(e.formula).not.toMatch(/undefined|NaN/);
      for (const r of e.table?.rows ?? []) expect(r.join(' ')).not.toMatch(/undefined|NaN/);
    }
  });

  it('the effective skill example matches effectiveSkill', () => {
    const s = makeVillage(), p = s.player;
    p.core.skills = { [EFF_EX.skill]: { raw: 0, state: 'normal' }, [EFF_EX.standIn]: { raw: EFF_EX.trueSkill, state: 'normal' } };
    p.core.perks = [];
    getLibrary().items.ex_ring = { id: 'ex_ring', kind: 'trinket', name: 'ring', look: '', bulk: 0, value: 0,
      effects: [{ kind: 'skill', skill: EFF_EX.standIn, value: EFF_EX.gear, active: 'worn', scope: 'any' }] } as never;
    p.core.inventory = [{ id: 'r', itemId: 'ex_ring', equippedIn: ['acc:ring'] }];
    const eff = effectiveSkill(s, p, EFF_EX.skill);
    expect(eff.skill).toBe(EFF_EX.standIn);
    expect(eff.value).toBeCloseTo(effExample());
  });
});
