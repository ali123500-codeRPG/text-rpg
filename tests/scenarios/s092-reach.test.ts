// 92 Reach: a reach-1 spear hits a target one linked zone away with sight; the same attack through a link without sight
// becomes a wasted action.
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';

it('92 Reach', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  s.player.core.inventory.push({ id: 'sp', itemId: 'spear' });
  place(s, 'patron_1', 'tav_counter'); // tav_common -> tav_counter: sight
  place(s, 'trader', 'street_door'); // tav_common -> street_door: no sight
  const gear = [{ op: 'stow' as const, item: 'player_arming_sword_1' }, { op: 'stow' as const, item: 'player_round_shield_2' }, { op: 'draw' as const, item: 'sp' }];
  const ev = play(s, { intent: intent({ gear, action: { type: 'attack', target: 'patron_1', skill: 'melee_medium', item: 'sp', mode: 'thrust' } }) });
  expect(ev.find((e) => e.actorId === 'player' && e.target === 'patron_1')).toMatchObject({ kind: 'attack' });
  const ev2 = play(s, { intent: intent({ action: { type: 'attack', target: 'trader', skill: 'melee_medium', item: 'sp', mode: 'thrust' } }) });
  expect(ev2.find((e) => e.actorId === 'player' && e.target === 'trader')).toMatchObject({ kind: 'wasted' });
});
