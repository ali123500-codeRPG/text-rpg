// 146 A foe's gear in its rating: GEAR_RATING_FACTOR × the coin value of its held and worn gear, on the foe's side only.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actorLevel, gearRating, killXp, levelRating, rating } from '../../src/engine/xp';
import { itemValue } from '../../src/ruleset/value';
import { itemDef } from '../../src/library';
import { CONFIG } from '../../src/config';
import { TP } from '../../src/library/templateIds';

describe('146 Gear in the rating', () => {
  it('a geared foe pays its gear coin × GEAR_RATING_FACTOR on top; carried items do not count', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    const coin = g.core.inventory.filter((i) => i.equippedIn?.length).reduce((n, i) => n + itemValue(s, itemDef(s, i.itemId)), 0);
    expect(coin).toBeGreaterThan(0);
    expect(gearRating(s, g)).toBeCloseTo(CONFIG.GEAR_RATING_FACTOR * coin);
    expect(killXp(s, g)).toBeCloseTo(rating(g) + CONFIG.GEAR_RATING_FACTOR * coin, 1); // a strong foe: no taper
    for (const i of g.core.inventory) delete i.equippedIn; // stowed gear is not power in the fight
    expect(gearRating(s, g)).toBe(0);
  });
  it("the player's own gear never shrinks the taper on a weak foe", () => {
    const s = makeVillage();
    const slime = s.actors.find((a) => a.core.templateId === TP.slime)!;
    const before = killXp(s, slime);
    expect(gearRating(s, s.player)).toBeGreaterThan(0);
    expect(killXp(s, slime)).toBe(Math.round(rating(slime) * Math.min(1, CONFIG.KILL_XP_TAPER * rating(slime) / rating(s.player)) * CONFIG.KILL_XP_MULT * 10) / 10);
    expect(before).toBe(killXp(s, slime));
  });
  it('levels add LEVEL_RATING_SHARE × the XP they cost (LEVEL_XP × L(L−1)/2), on both sides', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    expect(actorLevel(g)).toBe(4); // an NPC's level is its template's
    expect(levelRating(g)).toBeCloseTo(CONFIG.LEVEL_RATING_SHARE * CONFIG.LEVEL_XP * 6); // 4 × 3 ÷ 2
    const keep = CONFIG.LEVEL_RATING_SHARE;
    const base = rating(g);
    (CONFIG as { LEVEL_RATING_SHARE: number }).LEVEL_RATING_SHARE = keep * 2; // a balance lever
    expect(rating(g)).toBeCloseTo(base + levelRating(g) / 2);
    (CONFIG as { LEVEL_RATING_SHARE: number }).LEVEL_RATING_SHARE = keep;
    // the player's free and bonus levels cost no XP, so they don't count
    const p = s.player;
    p.core.classes = [{ ...p.core.classes[0], level: 5 }];
    p.progression = { ...p.progression!, freeLevelsTaken: 1, bonusLevelsTaken: 0 };
    expect(actorLevel(p)).toBe(4);
  });
});
