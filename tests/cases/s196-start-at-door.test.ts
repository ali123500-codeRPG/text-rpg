// 196 BG-49 (playtest runs 46, 47): a story that opens in the street started the player at the street's middle, 20 m from the
// tavern door, while the opening told them at the door. Now a story that opens outdoors puts the player at the way into the
// building beside it (the scenario's place first); a story that opens indoors leaves the player where placeAll put them.
import { expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { applyStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { wayLeftM } from '../../src/engine/position';
import { CONFIG } from '../../src/config';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };

it('BG-49: opening in the street, the player starts at the tavern door', () => {
  const s = toStoryStart(makeVillage());
  const plan = villageStagePlan();
  const street = plan.zones.find((z) => z.key === 'street_door')!;
  plan.zones = [street, ...plan.zones.filter((z) => z !== street)];
  applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
  expect(s.player.zone).toBe('street_door');
  expect(wayLeftM(s, s.player, 'tav_common')).toBeLessThanOrEqual(CONFIG.PLACE_SPACING_M + 0.01);
});

it('BG-49: opening indoors, nothing changes', () => {
  const s = toStoryStart(makeVillage());
  applyStagePlan(s, villageStagePlan(), ctx, { entry: 'open' }, createRng(1));
  expect(s.player.zone).toBe('tav_common');
  expect(s.player.pos).toBeDefined();
});
