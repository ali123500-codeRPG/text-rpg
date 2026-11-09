// 132 Give part of a stack: "hand him two coins" moves two, joins the receiver's stack, and the event says how many.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildNarrationView } from '../../src/views';
import { actorById } from '../../src/engine/relations';

it('132 Give part of a stack', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  s.player.core.inventory = s.player.core.inventory.filter((i) => i.itemId !== 'coin');
  s.player.core.inventory.push({ id: 'purse', itemId: 'coin', qty: 20 });
  const coins = (id: string) => actorById(s, id)!.core.inventory.filter((i) => i.itemId === 'coin').reduce((n, i) => n + (i.qty ?? 1), 0);
  const before = coins('patron_1');
  const ev = play(s, { intent: intent({ action: { type: 'give', target: 'patron_1', item: 'purse', qty: 2 } }) });
  expect(coins('player')).toBe(18);
  expect(coins('patron_1')).toBe(before + 2);
  const give = ev.find((e) => e.actorId === 'player' && e.kind === 'give')!;
  expect(give.qty).toBe(2);
  expect(buildNarrationView(s, [give]).events[0].item).toBe('2 copper');
  // more than you have is wasted; nothing moves
  const ev2 = play(s, { intent: intent({ action: { type: 'give', target: 'patron_1', item: 'purse', qty: 30 } }) });
  expect(ev2.some((e) => e.actorId === 'player' && e.kind === 'wasted')).toBe(true);
  expect(coins('player')).toBe(18);
  // no qty gives the whole stack
  play(s, { intent: intent({ action: { type: 'give', target: 'patron_1', item: 'purse' } }) });
  expect(coins('player')).toBe(0);
  expect(coins('patron_1')).toBe(before + 20);
});
