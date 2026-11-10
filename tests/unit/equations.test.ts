// The Equations tab is built from equations(); it must build from the live library and CONFIG without throwing.
import { describe, expect, it } from 'vitest';
import { EFF_EX, effExample, equations } from '../../src/ruleset/equations';
import { effectiveSkill } from '../../src/ruleset/gear';
import { getLibrary } from '../../src/library';
import { actor, forcedRng, makeVillage } from '../harness';
import { moraleRoll, tierLevel } from '../../src/ruleset';
import { maxMorale, tierCostMult } from '../../src/ruleset/morale';
import { SK } from '../../src/library/skillIds';
import { prototypeLibrary } from '../../src/library/data';
import { xpToNext } from '../../src/engine/xp';
import { classMaxLevel } from '../../src/library/spawn';
import { CLASS_TIERS } from '../../src/scales';

describe('equations for the library viewer', () => {
  it('builds every group with numbers from CONFIG', () => {
    const groups = equations(prototypeLibrary());
    expect(groups.map((g) => g.key)).toEqual(['rolls', 'attacks', 'gain', 'levels', 'marking']);
    for (const g of groups) for (const e of g.equations) {
      expect(e.formula).not.toMatch(/undefined|NaN/);
      for (const r of e.table?.rows ?? []) expect(r.join(' ')).not.toMatch(/undefined|NaN/);
    }
  });

  it('the level tables match xpToNext and classMaxLevel', () => {
    const lv = equations(prototypeLibrary()).find((g) => g.key === 'levels')!.equations;
    const p = makeVillage().player;
    for (const [from, , need] of lv[0].table!.rows) {
      p.core.classes = [{ classId: p.core.classes[0].classId, state: 'current', level: Number(from) }];
      expect(xpToNext(p)).toBe(Number(need));
    }
    for (const c of Object.values(prototypeLibrary().classes)) {
      expect(lv[1].table!.rows.find(([t]) => t === CLASS_TIERS.name(c.tier))?.[1]).toBe(String(classMaxLevel(c.id)));
    }
  });

  it('the morale table matches moraleRoll and the tier multipliers', () => {
    const eq = equations(prototypeLibrary()).find((g) => g.key === 'rolls')!.equations.find((e) => e.name === 'Morale roll')!;
    for (const [r, max, share] of eq.table!.rows) {
      const s = makeVillage(), a = actor(s, 'patron_1');
      a.core.skills[SK.resolve] = { raw: Number(r), state: 'normal' };
      expect(String(maxMorale(a))).toBe(max);
      let t = 0;
      for (let d = 1; d <= 100; d++) t += tierCostMult(tierLevel(moraleRoll(s, a, forcedRng([d]))));
      expect(`×${(t / 100).toFixed(2)}`).toBe(share);
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
