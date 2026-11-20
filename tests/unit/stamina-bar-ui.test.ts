// FT20 on the sheet: one stamina bar for the long term (sleep debt, the level word), with the thin breath line under it
// sized to the level's band; these check the numbers the bar is drawn from.
import { describe, expect, it } from 'vitest';
import { staminaOf } from '../../src/views';
import { barMax, lineMax } from '../../src/ruleset/fatigue';
import { makeVillage } from '../harness';

describe('the stamina bar', () => {
  it("the bar and its breath line come from the player's own fatigue", () => {
    const p = makeVillage().player;
    p.core.condition.fatigue = { debt: barMax(p) * 0.35, line: 0 };
    const v = staminaOf(p);
    expect(v.level).toBe('Tired');
    expect(v.max).toBeCloseTo(barMax(p), 1);
    expect(v.lineMax).toBeCloseTo(lineMax(p), 1);
    expect(v.lineMax).toBeCloseTo(v.max * 0.8, 1); // Tired's band is 80% of the bar
    expect(v.lineLeft).toBeLessThanOrEqual(v.lineMax);
  });
});
