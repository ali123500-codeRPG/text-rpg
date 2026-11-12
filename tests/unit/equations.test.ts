// The Equations tab is built from equations(); it must build from the live library and CONFIG without throwing.
import { describe, expect, it } from 'vitest';
import { EFF_EX, SKILL_ROLL_EX, effExample, equations } from '../../src/ruleset/equations';
import { effectiveSkill } from '../../src/ruleset/gear';
import { getLibrary } from '../../src/library';
import { actor, forcedRng, makeVillage } from '../harness';
import { moraleRoll, ruleset, tierLevel } from '../../src/ruleset';
import { maxMorale, tierCostMult } from '../../src/ruleset/morale';
import { SK } from '../../src/library/skillIds';
import { prototypeLibrary } from '../../src/library/data';
import { xpToNext } from '../../src/engine/xp';
import { classMaxLevel } from '../../src/library/spawn';
import { CLASS_TIERS, TIERS } from '../../src/scales';

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

  // CS6 (b): the worked examples and tables are checked against the real roll, not a copy of its maths
  const rollAt = (skill: number) => {
    const s = makeVillage(), p = s.player;
    p.core.skills = { [SK.melee_medium]: { raw: skill, state: 'normal' } };
    p.core.perks = []; p.core.inventory = [];
    expect(effectiveSkill(s, p, SK.melee_medium).value).toBe(skill);
    return (d: number) => ruleset.roll({ actorId: p.id, skill: SK.melee_medium, modifiers: [], tierShifts: [], auto: false }, s, forcedRng([d]));
  };
  const rolls = () => equations(prototypeLibrary()).find((g) => g.key === 'rolls')!.equations;

  it('the skill roll example matches ruleset.roll', () => {
    const r = rollAt(SKILL_ROLL_EX.eff)(SKILL_ROLL_EX.d);
    const note = rolls().find((e) => e.name === 'Skill roll')!.notes![0];
    expect(note).toContain(`margin ${+r.margin.toFixed(2)} → ${TIERS.name(TIERS.at(tierLevel(r)))}.`);
  });

  it('the chance table matches ruleset.roll over every d100', () => {
    const t = rolls().find((e) => e.name === 'Chance by effective skill')!.table!;
    const at = ['near_miss', 'success', 'great_success', 'critical_success'] as const;
    for (const [skill, ...cells] of t.rows) {
      const roll = rollAt(Number(skill));
      const levels = Array.from({ length: 100 }, (_, i) => tierLevel(roll(i + 1)));
      expect(cells).toEqual(at.map((k) => `${levels.filter((l) => l >= TIERS.pos(k)).length}%`));
    }
  });
});
