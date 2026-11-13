// FT20 on the sheet: one stamina bar for the long term (sleep debt, the level word), with the thin breath line under it
// sized to the level's band; these check the numbers the bar is drawn from, through whole turns.
import { describe, expect, it } from 'vitest';
import { staminaOf } from '../../src/views';
import { barMax, lineMax } from '../../src/ruleset/fatigue';
import { wholeTurn, intent } from '../harness/turn';

describe('the stamina bar', () => {
  it("whole turn: the bar and its breath line come from the player's own fatigue", async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!, p = s.player;
    p.core.condition.fatigue = { debt: barMax(p) * 0.35, line: 0 };
    await g.turn(intent(), 'I look around');
    const v = staminaOf(p);
    expect(v.level).toBe('Tired');
    expect(v.max).toBeCloseTo(barMax(p), 1);
    expect(v.left).toBeLessThan(v.max * 0.7); // 35% used, and the turn's hours awake on top
    expect(v.lineMax).toBeCloseTo(lineMax(p), 1);
    expect(v.lineMax).toBeCloseTo(v.max * 0.8, 1); // Tired's band is 80% of the bar
    expect(v.lineLeft).toBeLessThanOrEqual(v.lineMax);
  });
});
