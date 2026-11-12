// 93 Thrown: a thrown dagger ends on the ground of the target's zone, hit or miss. A knife is thrown 7 m (THROW_M), so
// until positions exist it reaches only its own zone.
import { AM } from '../../src/library/tableIds';
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

it.each([11, 22, 33, 44])('93 Thrown (seed %i)', (seed) => {
  const s = makeVillage({ playerZone: 'tav_common', seed });
  s.player.core.inventory.find((i) => i.id === `player_${IT.round_shield}_2`)!.equippedIn = undefined;
  s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger, equippedIn: ['grip:left_arm'] });
  place(s, 'patron_1', 'tav_common').mind!.slots!.seat = 'tav_common'; // keep it there (its routine would walk it away first)
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.ranged_light, item: 'dg', mode: AM.throw } }) }, seed);
  expect(ev.find((e) => e.actorId === 'player')).toMatchObject({ kind: 'attack', target: 'patron_1' });
  expect(s.zones.find((z) => z.id === 'tav_common')!.groundItems.map((i) => i.id)).toContain('dg');
  expect(s.player.core.inventory.some((i) => i.id === 'dg')).toBe(false);
});
