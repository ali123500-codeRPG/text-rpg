// BG-153 (run 92b t21-22): "round the side to the yard gate" walked 30 m the wrong way. The lane and the yard are linked
// but don't touch, so the gate's spot fell back to the far end of the lane, while the walk itself leaves by the lane's
// edge nearest the yard. The way out of a zone is one point, where the walk leaves it (crossing), for spots and walks alike.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { spotPoint, wayPoint } from '../../src/engine/position';
import { zoneById } from '../../src/engine/relations';

it('the way to a linked zone that doesn\'t touch is the edge nearest it', () => {
  const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'guard_1', 'trader', 'patron_1'] });
  zoneById(s, 'street_door')!.rect = { x: 0, y: 0, w: 40, d: 10 };
  zoneById(s, 'street_square')!.rect = { x: 40, y: 0, w: 20, d: 20 };
  s.player.pos = { x: 19, y: 0 };
  expect(wayPoint(s, 'street_door', 'street_square', s.player)).toEqual({ x: 20, y: 0 });
  expect(spotPoint(s, 'street_door', { near: 'street_square' }, s.player)!.pos.x).toBeGreaterThan(15);
});
