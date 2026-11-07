// 38 Hidden terms: a public zone description containing one of the plan's hiddenTerms fails validation.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scene';
import { toStoryStart, villageStagePlan } from '../../src/scene/fixtures';

describe('38 Hidden terms', () => {
  it('a zone look with a hidden term fails', () => {
    const p = villageStagePlan();
    p.zones[5].look = 'wet grass and a trail toward the Nest';
    const errs = validateStagePlan(toStoryStart(makeVillage()), p, { tier: 'success', kind: 'scene', placeId: 'tavern' });
    expect(errs).toEqual([expect.objectContaining({ code: 'public_leak', routineOnly: false })]);
    expect(errs[0].message).toContain('zone field_mid look');
  });
  it('a key with a hidden term fails: keys become ids the player side sees (Q2)', () => {
    const p = villageStagePlan();
    const old = p.zones[5].key;
    p.zones[5].key = 'nest_trail';
    for (const z of p.zones) for (const l of z.links) if (l.to === old) l.to = 'nest_trail';
    const errs = validateStagePlan(toStoryStart(makeVillage()), p, { tier: 'success', kind: 'scene', placeId: 'tavern' });
    expect(errs.some((e) => e.code === 'public_leak' && e.message.includes('zone key nest_trail'))).toBe(true);
  });
});
