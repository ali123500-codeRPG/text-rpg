// 35 Stakes only: a Failure-tier plan whose threats are unaware and unalert passes validation.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scene';
import { toStoryStart, villageStagePlan } from '../../src/scene/fixtures';

describe('35 Stakes only', () => {
  it('unaware threats under a Failure tier are fine', () => {
    const p = villageStagePlan(-2);
    for (const c of p.cast) c.awarenessOfPlayer = 'unaware';
    expect(p.event).toMatchObject({ challenge: 'moderate', gain: 'minor' });
    expect(validateStagePlan(toStoryStart(makeVillage()), p, { tier: -2, kind: 'scene', placeId: 'tavern' })).toEqual([]);
  });
});
