// 131 Class level cap: a class levels no higher than CLASS_MAX_LEVEL (20). XP past the cap banks until a class with
// room is picked, then every banked level is taken at once. The default class (Commoner) opens at the cap.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { awardXp, charLevel, levelTarget, spendXp, xpToNext } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { CL } from '../../src/library/classIds';

describe('131 Class level cap', () => {
  it('XP banks at the cap, the default class opens, and picking it takes every banked level', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    expect(CONFIG.CLASS_MAX_LEVEL).toBe(20);
    expect(getLibrary().classes[CL.commoner].name).toBe('Commoner');
    p.core.classes = [{ classId: CL.swordsman, state: 'current', level: 19 }];
    awardXp(s, xpToNext(p), 'test'); // 19 → 20
    expect(p.core.classes[0].level).toBe(20);
    expect(levelTarget(p)).toBeUndefined();
    expect(p.core.classes).toContainEqual({ classId: CL.commoner, state: 'unlocked', level: 0 });
    const banked = CONFIG.LEVEL_XP * (20 + 21 + 22);
    awardXp(s, banked + 5, 'test');
    expect(charLevel(p)).toBe(20); // banked, no level
    expect(pr.xp).toBe(banked + 5);
    pr.nextClass = CL.commoner; // the sheet's picker
    spendXp(s);
    expect(p.core.classes.map((c) => [c.classId, c.state, c.level])).toEqual([[CL.swordsman, 'previous', 20], [CL.commoner, 'current', 3]]);
    expect(pr.xp).toBe(5);
  });
});
