// 148 Guard (tier 1) unlocks with any weapon skill 40, any armor skill 40, any defense skill 30, and a perk that adds a
// hearing link (Keen Ear). Perks carry hearingDb; hearing sums it.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { unlockClasses } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { perkSum } from '../../src/ruleset/perks';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { PK } from '../../src/library/perkIds';

describe('148 Guard class', () => {
  it('needs one skill from each group and a hearing-link perk', () => {
    const s = makeVillage(), p = s.player;
    expect(getLibrary().classes[CL.guard].tier).toBe('tier_1');
    p.core.classes = [{ classId: CL.commoner, state: 'current', level: 1 }];
    p.core.perks = [];
    const set = (raw: Record<string, number>) => { p.core.skills = {}; for (const [id, v] of Object.entries(raw)) p.core.skills[id] = { raw: v, state: 'normal' }; };
    const has = () => p.core.classes.some((c) => c.classId === CL.guard);
    set({ [SK.ranged_heavy]: 40, [SK.heavy_armor]: 40, [SK.dodge]: 30, [SK.earshot]: 20 });
    unlockClasses(s);
    expect(has()).toBe(false); // no hearing-link perk yet
    p.core.perks.push({ perkId: PK.keen_ear, source: 'level', gainedTurn: 0 });
    expect(perkSum(p, 'hearingDb')).toBe(10);
    set({ [SK.ranged_heavy]: 40, [SK.heavy_armor]: 40, [SK.dodge]: 29 });
    unlockClasses(s);
    expect(has()).toBe(false); // defense short
    set({ [SK.ranged_heavy]: 40, [SK.heavy_armor]: 40, [SK.dodge]: 30 });
    unlockClasses(s);
    expect(p.core.classes).toContainEqual({ classId: CL.guard, state: 'unlocked', level: 0 });
  });
});
