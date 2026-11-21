// 413 BG-1476: the hero took the pack from a body on the village green while a bounty-chaser stood right beside it, on the
// hero's side. The walk to the body was a plain walk at its point, so it stopped where she stood in the way, a step short
// of reach, three turns running. A walk to take from a body now steps round to a free spot by it, as a search or a
// hand-over does.
import { expect, it } from 'vitest';
import { makeVillageResized } from '../harness';
import { intent, play } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { actorById } from '../../src/engine/relations';
import { distM } from '../../src/engine/position';
import { boxOf } from '../../src/plan/geom';
import { zoneById } from '../../src/engine/relations';

it('a body with someone standing on the near side of it is still reached, and its pack taken in one turn', () => {
  const s = makeVillageResized({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'patron_1'] }, 'field_mid', (r) => ({ ...r, w: 60 }));
  const c = boxOf(zoneById(s, 'field_mid')!.outline);
  const body = actorById(s, 'trader')!, by = actorById(s, 'guard_1')!;
  for (const a of [body, by]) { a.zone = 'field_mid'; a.placeId = s.player.placeId; }
  s.player.pos = { x: c.x - 4, y: c.y };
  body.pos = { x: c.x, y: c.y };
  body.core.condition.hpLostPct = 105; // down
  body.core.inventory.push({ id: 'pack_1', itemId: IT.sack });
  by.pos = { x: c.x - 1.0, y: c.y }; // between them, a hand's breadth from the body
  expect(distM(s, by, body)).toBeLessThan(0.65);
  play(s, { intent: intent({ gear: [{ op: 'pick_up', item: 'pack_1', from: body.id }] }) });
  expect(s.player.core.inventory.some((i) => i.id === 'pack_1')).toBe(true);
  expect(s.log.some((l) => l.code === 'pick_up_short')).toBe(false);
});
