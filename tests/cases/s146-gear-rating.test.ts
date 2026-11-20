// 146 Gear in power: weapons, armor and shields count through the combat level, skill lines through the ratings; coin no longer counts (GR45).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actorLevel, levelCost, levelRating, power, xpToReach } from '../../src/engine/xp';
import { CONFIG } from '../../src/config';
import { TP } from '../../src/library/templateIds';

describe('146 Gear in power (GR45: through the fight, never by its coin)', () => {
  it('a geared foe is stronger through its weapon and armor in the combat level; stowed gear does not count', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    const geared = power(s, g);
    for (const i of g.core.inventory) delete i.equippedIn; // stowed gear is not power in the fight
    expect(power(s, g)).toBeLessThan(geared);
  });
  it('levels add LEVEL_RATING_SHARE × what the XP curve asks to reach them, on both sides', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    expect(actorLevel(g)).toBe(CONFIG.RANK_ROWS.rank_2.level + 1); // an NPC's level comes from its skills: a Trained guard's, plus one for its Battle Sense (TC9 a, Soldier High)
    expect(xpToReach(4)).toBe(levelCost(0) + levelCost(1) + levelCost(2) + levelCost(3)); // asks the XP curve
    expect(levelRating(g)).toBeCloseTo(CONFIG.LEVEL_RATING_SHARE * xpToReach(actorLevel(g)));
    const before = levelRating(g), lx = CONFIG.LEVEL_XP; // the two are linked: a steeper curve raises the rating too
    (CONFIG as { LEVEL_XP: number }).LEVEL_XP = lx * 2;
    expect(levelRating(g)).toBeCloseTo(2 * before, 0); // each step is rounded to whole XP
    (CONFIG as { LEVEL_XP: number }).LEVEL_XP = lx;
    const keep = CONFIG.LEVEL_RATING_SHARE;
    const base = power(s, g);
    (CONFIG as { LEVEL_RATING_SHARE: number }).LEVEL_RATING_SHARE = keep * 2; // a balance lever
    expect(power(s, g)).toBeCloseTo(base + levelRating(g) / 2);
    (CONFIG as { LEVEL_RATING_SHARE: number }).LEVEL_RATING_SHARE = keep;
    // the player's free and bonus levels count like any other level
    const p = s.player;
    p.core.classes = [{ ...p.core.classes[0], level: 5 }];
    p.progression = { ...p.progression!, freeLevelsTaken: 1, bonusLevelsTaken: 1 };
    expect(actorLevel(p)).toBe(6);
    expect(levelRating(p)).toBeCloseTo(CONFIG.LEVEL_RATING_SHARE * xpToReach(6));
  });
});
