// 38 Hidden terms: a public zone description containing one of the plan's hiddenTerms fails validation.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scene';
import { toStoryStart, villageStagePlan } from '../../src/scene/fixtures';

describe('38 Hidden terms', () => {
  it('a zone look with a hidden term fails', () => {
    const p = villageStagePlan();
    p.zones[5].look = 'wet grass and a trail toward the Nest';
    const errs = validateStagePlan(toStoryStart(makeVillage()), p, { tier: 0, kind: 'scene', placeId: 'tavern' });
    expect(errs).toEqual([expect.objectContaining({ code: 'public_leak', routineOnly: false })]);
    expect(errs[0].message).toContain('zone field_mid look');
  });
});
