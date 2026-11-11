// 92 Reach: reach is metres turned into zone links. A shortbow (50 m) hits a target one linked zone away with sight; the
// same shot through a link without sight becomes a wasted action, and a spear (2.8 m) can't reach the next zone at all.
import { AM } from '../../src/library/tableIds';
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

it('92 Reach', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  s.player.core.inventory.push({ id: 'sp', itemId: IT.spear });
  place(s, 'patron_1', 'tav_counter').mind!.slots!.seat = 'tav_counter'; // tav_common -> tav_counter: sight
  place(s, 'trader', 'street_door').mind!.slots!.counter = 'street_door'; // routines keep both where they are // tav_common -> street_door: no sight
  s.player.core.inventory.push({ id: 'bw', itemId: IT.shortbow });
  const stow = [{ op: 'stow' as const, item: `player_${IT.arming_sword}_1` }, { op: 'stow' as const, item: `player_${IT.round_shield}_2` }];
  const ev0 = play(s, { intent: intent({ gear: [...stow, { op: 'draw' as const, item: 'sp' }], action: { type: 'attack', target: 'patron_1', skill: SK.melee_medium, item: 'sp', mode: AM.thrust } }) });
  expect(ev0.find((e) => e.actorId === 'player' && e.target === 'patron_1')).toMatchObject({ kind: 'wasted' });
  const shoot = { type: 'attack' as const, skill: SK.ranged_light, item: 'bw', mode: AM.shoot };
  const ev = play(s, { intent: intent({ gear: [{ op: 'stow' as const, item: 'sp' }, { op: 'draw' as const, item: 'bw' }], action: { ...shoot, target: 'patron_1' } }) });
  expect(ev.find((e) => e.actorId === 'player' && e.target === 'patron_1')).toMatchObject({ kind: 'attack' });
  const ev2 = play(s, { intent: intent({ action: { ...shoot, target: 'trader' } }) });
  expect(ev2.find((e) => e.actorId === 'player' && e.target === 'trader')).toMatchObject({ kind: 'wasted' });
});
