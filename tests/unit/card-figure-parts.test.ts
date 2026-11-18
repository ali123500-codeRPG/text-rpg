// P2: every figure on the character card opens its parts, read from the function that makes it, so the lines add up:
// standing attack and defense (effectiveSkill's base and gear lines), total health and max morale.
import { describe, expect, it } from 'vitest';
import { effectiveSkill, totalHp } from '../../src/ruleset';
import { maxMorale } from '../../src/ruleset/morale';
import type { FigPart } from '../../src/ruleset/body';
import { DEFENSE_SKILL } from '../../src/library/skillIds';
import { SK } from '../../src/library/skillIds';
import { defenseItem } from '../../src/ruleset/gear';
import { makeVillage } from '../harness';

const sum = (parts: FigPart[]) => parts.reduce((n, x) => (x.times !== undefined ? n * x.times : n + (x.adds ?? 0)), 0);

describe('card figures add up (P2)', () => {
  it('total health: base and Endurance, times body and prefix', () => {
    const s = makeVillage(), parts: FigPart[] = [];
    const total = totalHp(s, s.player, parts);
    expect(sum(parts)).toBeCloseTo(total, 6);
    expect(parts[0].label).toBe('Base');
    expect(totalHp(s, s.player)).toBe(total); // the plain call is unchanged
  });

  it('max morale: base, Resolve and achievements', () => {
    const s = makeVillage(), parts: FigPart[] = [];
    const max = maxMorale(s.player, parts);
    expect(sum(parts)).toBeCloseTo(max, 6);
  });

  it('an effective skill is its base plus each gear, trade and augment line', () => {
    const s = makeVillage(), p = s.player;
    for (const [skill, ctx] of [[DEFENSE_SKILL[p.core.standingDefense], { itemId: defenseItem(s, p, p.core.standingDefense)?.id }], [SK.dodge, {}], [SK.eyesight, {}]] as const) {
      const e = effectiveSkill(s, p, skill, ctx);
      expect(e.base + e.gear.reduce((n, g) => n + g.value, 0), skill).toBeCloseTo(e.value, 6);
    }
  });
});
