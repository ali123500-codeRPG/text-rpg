// The power rating on the Character page: power() shown as one number, and its parts (level, combat level, each non-combat
// group) read from the same function, so the lines always add up to the number and no second formula exists. The ratings
// (GR7) sit below in their own list, in skill points.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { power } from '../../src/engine/xp';
import { combatLevel } from '../../src/engine/combatLevel';
import { powerLines, ratingLines } from '../../src/ui/power';
import { compoundRating } from '../../src/ruleset/ratings';
import { RT } from '../../src/library/functionIds';

describe('power rating on the character sheet', () => {
  it('whole turn: the lines add up to power(); the combat line names the combat level; ratings list in skill points', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent(), 'I look around');
    const s = g.game.state()!, p = s.player;
    const { total, lines } = powerLines(s, p);
    expect(total).toBeCloseTo(power(s, p), 9);
    expect(lines.reduce((n, l) => n + (l.adds ?? 0), 0)).toBeCloseTo(total, 9);
    expect(lines[0].label).toMatch(/^Level \d+$/);
    expect(lines[1].label).toBe(`Combat level ${Math.round(combatLevel(s, p) * 10) / 10}`);
    const strength = ratingLines(s, p).find((l) => l.label === 'Melee strength');
    expect(Number(strength?.value)).toBeCloseTo(compoundRating(s, p, RT.melee_strength).rating, 1);
  });
});
