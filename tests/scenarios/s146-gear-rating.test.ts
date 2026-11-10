// 146 A foe's gear in its rating: GEAR_RATING_FACTOR × the coin value of its held and worn gear, on the foe's side only.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { gearRating, killXp, rating } from '../../src/engine/xp';
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
});
