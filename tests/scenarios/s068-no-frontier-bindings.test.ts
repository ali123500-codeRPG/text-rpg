// 68 No frontier bindings: a slot bound to a frontier key fails validation.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scene';
import { toStoryStart, villageStagePlan, grovePlan } from '../../src/scene/fixtures';

describe('68 No frontier bindings', () => {
  it('a plan frontier key is never a valid binding', () => {
    const p = villageStagePlan();
    p.cast[4].slots = { route: ['field_far', 'field_mid'], post: 'woods' };
    expect(validateStagePlan(toStoryStart(makeVillage()), p, { tier: 0, kind: 'scene', placeId: 'tavern' }))
      .toEqual([expect.objectContaining({ code: 'frontier_binding', castKey: 'slime_2', routineOnly: true })]);
  });
  it('an existing frontier on the stage is never a valid binding either', () => {
    const s = makeVillage({ playerZone: 'field_far' });
    const p = grovePlan();
    p.cast = [{ template: 'slime', key: 'grove_slime', label: 'a slime', name: 'slime', appearance: 'green', band: 'slimes',
      routineSetId: 'slime_wander', slots: { route: ['grove', 'woods'], post: 'grove' }, awarenessOfPlayer: 'unaware', motive: '' }];
    const codes = validateStagePlan(s, p, { tier: 0, kind: 'extension', frontierKey: 'woods', placeId: 'field' }).map((e) => e.code);
    expect(codes).toContain('frontier_binding');
  });
});
