// 179 Event Roll Review (ER1, ER2, ER5): the tier sets the balance of gain against challenge, worst to best; Near Miss tilts
// slightly bad; the scenario's event roll shows on the Rolls line (only shown with Show rolls on).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { gradesFitText, gradesFitTier } from '../../src/scenario/validate';
import { mechanicsLines } from '../../src/agents/game';
import { WEAVER_INSTRUCTIONS } from '../../src/agents/prompts';

describe('179 event roll tiers (ER1, ER2)', () => {
  it('Great and Critical Success are good fortune: high gain, little challenge', () => {
    expect(gradesFitTier('great_success', 'minor', 'major')).toBe(true);
    expect(gradesFitTier('great_success', 'major', 'major')).toBe(false);
    expect(gradesFitTier('critical_success', 'none', 'extreme')).toBe(true);
    expect(gradesFitTier('critical_success', 'extreme', 'extreme')).toBe(false);
  });
  it('Near Miss gives a step less gain than its challenge; Success stays matched', () => {
    expect(gradesFitTier('near_miss', 'major', 'moderate')).toBe(true);
    expect(gradesFitTier('near_miss', 'moderate', 'moderate')).toBe(false);
    expect(gradesFitTier('success', 'moderate', 'moderate')).toBe(true);
    expect(gradesFitText()).toContain('Near Miss = challenge minor to major, gain one step below it');
    expect(gradesFitText()).toContain('Great Success = challenge none to moderate, gain major');
    expect(WEAVER_INSTRUCTIONS).toContain('high tiers are good fortune');
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
