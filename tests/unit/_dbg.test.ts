import { it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { worldCheck } from '../../src/scenario/ways';
it('dbg', () => {
  const s0 = makeVillage();
  console.log(worldCheck(s0));
  const s = toStoryStart(makeVillage());
  console.log(JSON.stringify(validateStagePlan(s, villageStagePlan(), { tier: 'success', kind: 'scenario', placeId: 'tavern' }), null, 1));
});
