// A class's unlock conditions are also its skill floors: a template with a class always meets them.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { classFloors, templateMinimums, validateBuild, recommendedBuild } from '../../src/library/spawn';
import { CL } from '../../src/library/classIds';
import { SK } from '../../src/library/skillIds';
import { TP } from '../../src/library/templateIds';

describe('161 class floors from unlock conditions', () => {
  it('floors include the unlock skills; either-of groups stay groups', () => {
    expect(classFloors(CL.trader).all[SK.barter]).toBe(20);
    expect(classFloors(CL.sword_dancer).all[SK.dodge]).toBe(40);
    expect(classFloors(CL.guard).any).toHaveLength(3);
  });
  it('every template with a class meets all its class floors', () => {
    makeVillage();
    for (const t of Object.values(getLibrary().templates)) {
      if (!t.classId) continue;
      const min = templateMinimums(t), f = classFloors(t.classId);
      for (const [id, v] of Object.entries(f.all)) expect(min[id] ?? 0, `${t.id} ${id}`).toBeGreaterThanOrEqual(v);
      for (const g of f.any) expect(Object.entries(g).some(([id, v]) => (min[id] ?? 0) >= v), `${t.id} group`).toBe(true);
    }
  });
  it('the guard template is a Guard and already meets its groups; an unmet group raises the skill it has most of', () => {
    makeVillage();
    const t = getLibrary().templates[TP.guard];
    expect(t.classId).toBe(CL.guard);
    expect(templateMinimums(t)).toEqual(t.minimums); // block 30 meets the defense group
    const weak = { ...t, minimums: { ...t.minimums, [SK.block]: 10, [SK.dodge]: 20 } };
    expect(templateMinimums(weak)[SK.dodge]).toBe(30);
    expect(templateMinimums(weak)[SK.block]).toBe(10);
  });
  it('the recommended Swordsman build still passes', () => {
    makeVillage();
    expect(validateBuild({ ...recommendedBuild(), name: 'Aldric' })).toEqual([]);
  });
});
