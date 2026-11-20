// 38 Hidden terms: a public zone description containing one of the plan's hiddenTerms fails validation.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';

describe('38 Hidden terms', () => {
  it('a key with a hidden term fails: keys become ids the player side sees (Q2)', () => {
    const p = villageStagePlan();
    const old = p.zones[5].key;
    p.zones[5].key = 'nest_trail';
    for (const z of p.zones) for (const l of z.ways) if (l.to === old) l.to = 'nest_trail';
    const errs = validateStagePlan(toStoryStart(makeVillage()), p, { tier: 'success', kind: 'scenario', placeId: 'tavern' });
    expect(errs.some((e) => e.code === 'public_leak' && e.message.includes('zone key nest_trail'))).toBe(true);
  });
});
