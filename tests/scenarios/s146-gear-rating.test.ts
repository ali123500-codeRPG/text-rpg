// 146 Gear in the rating: GEAR_RATING_FACTOR × the coin value of held and worn gear, on both sides (the player's too).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actorLevel, gearRating, killXp, levelCost, levelRating, rating, xpToReach } from '../../src/engine/xp';
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
  it("the player's own gear counts in the player's rating, so it shrinks the taper on a weak foe", () => {
    const s = makeVillage();
    const slime = s.actors.find((a) => a.core.templateId === TP.slime)!;
    const mine = gearRating(s, s.player);
    expect(mine).toBeGreaterThan(0);
    const theirs = rating(slime) + gearRating(s, slime);
    expect(killXp(s, slime)).toBe(Math.round(theirs * Math.min(1, CONFIG.KILL_XP_TAPER * theirs / (rating(s.player) + mine)) * CONFIG.KILL_XP_MULT * 10) / 10);
    const geared = killXp(s, slime);
    for (const i of s.player.core.inventory) delete i.equippedIn; // stowed gear is not power
    expect(killXp(s, slime)).toBeGreaterThan(geared);
  });
  it('levels add LEVEL_RATING_SHARE × what the XP curve asks to reach them, on both sides', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    expect(actorLevel(g)).toBe(4); // an NPC's level is its template's
    expect(xpToReach(4)).toBe(levelCost(0) + levelCost(1) + levelCost(2) + levelCost(3)); // asks the XP curve
    expect(levelRating(g)).toBeCloseTo(CONFIG.LEVEL_RATING_SHARE * xpToReach(4));
    const lx = CONFIG.LEVEL_XP; // the two are linked: a steeper curve raises the rating too
    (CONFIG as { LEVEL_XP: number }).LEVEL_XP = lx * 2;
    expect(levelRating(g)).toBeCloseTo(CONFIG.LEVEL_RATING_SHARE * 2 * (lx + lx + 2 * lx + 3 * lx));
    (CONFIG as { LEVEL_XP: number }).LEVEL_XP = lx;
    const keep = CONFIG.LEVEL_RATING_SHARE;
    const base = rating(g);
    (CONFIG as { LEVEL_RATING_SHARE: number }).LEVEL_RATING_SHARE = keep * 2; // a balance lever
    expect(rating(g)).toBeCloseTo(base + levelRating(g) / 2);
    (CONFIG as { LEVEL_RATING_SHARE: number }).LEVEL_RATING_SHARE = keep;
    // the player's free and bonus levels count like any other level
    const p = s.player;
    p.core.classes = [{ ...p.core.classes[0], level: 5 }];
    p.progression = { ...p.progression!, freeLevelsTaken: 1, bonusLevelsTaken: 1 };
    expect(actorLevel(p)).toBe(6);
    expect(levelRating(p)).toBeCloseTo(CONFIG.LEVEL_RATING_SHARE * xpToReach(6));
  });
});
