// 93 Thrown: a thrown dagger ends on the ground of the target's zone, hit or miss.
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';

it.each([11, 22, 33, 44])('93 Thrown (seed %i)', (seed) => {
  const s = makeVillage({ playerZone: 'tav_common', seed });
  s.player.core.inventory.find((i) => i.id === 'player_round_shield_2')!.equippedIn = undefined;
  s.player.core.inventory.push({ id: 'dg', itemId: 'dagger', equippedIn: ['hand:left_arm'] });
  place(s, 'patron_1', 'tav_counter');
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: 'ranged_light', item: 'dg', mode: 'throw' } }) }, seed);
  expect(ev.find((e) => e.actorId === 'player')).toMatchObject({ kind: 'attack', target: 'patron_1' });
  expect(s.zones.find((z) => z.id === 'tav_counter')!.groundItems.map((i) => i.id)).toContain('dg');
  expect(s.player.core.inventory.some((i) => i.id === 'dg')).toBe(false);
});
