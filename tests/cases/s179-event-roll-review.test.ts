// 179 Event Roll Review (ER1, ER2, ER5): the tier sets the balance of gain against challenge, worst to best; Near Miss tilts
// slightly bad; the scenario's event roll shows on the Rolls line (only shown with Show rolls on).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { GRADES_FIT, gradesFitText, gradesFitTier } from '../../src/scenario/validate';
import { mechanicsLines } from '../../src/agents/game';
import { WEAVER_INSTRUCTIONS } from '../../src/agents/prompts';

describe('179 event roll tiers (ER1, ER2)', () => {
  it('Great Success is a prize one or two steps above a real challenge (SW1 b, SW2 a); Critical Success is the biggest gain inside a Critical Failure challenge (D-247)', () => {
    expect(gradesFitTier('great_success', 'minor', 'major')).toBe(false);
    expect(gradesFitTier('great_success', 'moderate', 'major')).toBe(true);
    expect(gradesFitTier('great_success', 'moderate', 'extreme')).toBe(true);
    expect(gradesFitTier('great_success', 'major', 'extreme')).toBe(true);
    expect(gradesFitTier('great_success', 'major', 'major')).toBe(false);
    // SW1 b: no tier allows a scenario with no challenge
    for (const t of Object.keys(GRADES_FIT) as (keyof typeof GRADES_FIT)[]) expect(GRADES_FIT[t].challenge[0], t).not.toBe('none');
    expect(GRADES_FIT.critical_success.challenge).toBe(GRADES_FIT.critical_failure.challenge);
    expect(gradesFitTier('critical_success', 'moderate', 'extreme')).toBe(false);
    expect(gradesFitTier('critical_success', 'major', 'extreme')).toBe(true);
    expect(gradesFitTier('critical_success', 'extreme', 'extreme')).toBe(true);
    expect(gradesFitTier('critical_success', 'extreme', 'major')).toBe(false);
  });
  it('Near Miss gives a step less gain than its challenge; Success stays matched', () => {
    expect(gradesFitTier('near_miss', 'major', 'moderate')).toBe(true);
    expect(gradesFitTier('near_miss', 'moderate', 'moderate')).toBe(false);
    expect(gradesFitTier('success', 'moderate', 'moderate')).toBe(true);
    expect(gradesFitText()).toContain('Near Miss = challenge minor to major, gain one step below it');
    expect(gradesFitText()).toContain('Great Success = challenge moderate to major, gain 1 to 2 steps above it');
    expect(WEAVER_INSTRUCTIONS).toContain('Every scenario, at every tier, has a real');
    expect(WEAVER_INSTRUCTIONS).toContain('never by a milder danger');
  });
});

describe('179 the event roll on the Rolls line (ER5)', () => {
  it('leads the scenario\'s mechanics lines with its d100, tier and modifiers', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const lines = mechanicsLines(s, [], { actorId: s.player.id, roll: 63, tier: 'success', modifiers: [{ source: 'Lucky charm', type: 'gear', value: 5 }] } as never);
    expect(lines[0]).toBe('Event roll d100 63 → Success [Lucky charm +5]');
    expect(mechanicsLines(s, [])).toEqual([]);
  });
});
