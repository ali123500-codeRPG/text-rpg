// The power rating on the Character page: power() shown as one number, and its parts (level, each skill group with its
// skills, gear) read from the same function, so the lines always add up to the number and no second formula exists.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { power, rating, gearRating } from '../../src/engine/xp';
import { powerLines } from '../../src/ui/power';

describe('power rating on the character sheet', () => {
  it('whole turn: the lines add up to power(), each group to its skills, and gear to its items', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent(), 'I look around');
    const s = g.game.state()!, p = s.player;
    const { total, lines } = powerLines(s, p);
    expect(total).toBeCloseTo(power(s, p), 9);
    expect(lines.reduce((n, l) => n + l.adds, 0)).toBeCloseTo(total, 9);
    for (const l of lines) if (l.sub?.length) expect(l.sub.reduce((n, x) => n + x.adds, 0)).toBeCloseTo(l.adds, 9);
    expect(lines[0].label).toMatch(/^Level \d+$/);
    const gear = lines.at(-1)!;
    expect(gear.label).toBe('Gear held and worn');
    expect(gear.adds).toBeCloseTo(gearRating(s, p), 9);
    expect(lines.slice(0, -1).reduce((n, l) => n + l.adds, 0)).toBeCloseTo(rating(p), 9);
    const melee = lines.find((l) => l.label === 'Melee skills')!;
    expect(melee.sub!.map((x) => x.how.split('counted ')[1])).toEqual(melee.sub!.map((_, i) => (i === 0 ? 'in full' : `at 1/${2 ** i}`)));
  });
});
