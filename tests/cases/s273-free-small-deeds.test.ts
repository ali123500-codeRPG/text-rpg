// 273 OA4 (Speech with actions, furnished rooms): small things never cost the turn. Looking at your own things and nothing
// else answers as /inv or /stats with no turn passing; setting something down where you stand is free gear, like stowing,
// so "set two coppers on the table and ask for a room" still asks this turn.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { wholeTurn } from '../harness/turn';
import { zoneById } from '../../src/engine/relations';
import { IT } from '../../src/library/itemIds';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';

it('OA4: setting part of a stack down is free gear: it lies where you stand, and the action still happens', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  s.player.core.inventory.push({ id: 'purse', itemId: IT.coin, qty: 10 });
  const i = intent({ gear: [{ op: 'set_down', item: 'purse', qty: 2 }], action: { type: 'wait' } });
  expect(checkParserLegality(i, buildPlayerView(s)).gearErrors).toEqual([]);
  const ev = play(s, { intent: i });
  expect(s.player.core.inventory.find((x) => x.id === 'purse')?.qty).toBe(8);
  expect(zoneById(s, 'tav_common')!.groundItems.find((x) => x.itemId === IT.coin)?.qty).toBe(2);
  expect(ev.some((e) => e.kind === 'set_down' && e.qty === 2)).toBe(true);
});

it('OA4: a worn thing is not set down until taken off', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const worn = s.player.core.inventory.find((x) => x.equippedIn?.includes('armor') || x.equippedIn?.includes('pack'))!;
  play(s, { intent: intent({ gear: [{ op: 'set_down', item: worn.id }] }) });
  expect(s.player.core.inventory.some((x) => x.id === worn.id)).toBe(true);
});

it('OA4: looking at your own things and nothing else takes no turn and answers like /inv', async () => {
  const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const t = g.game.state()!.turn;
  g.claude.push('parser', { ...intent(), look: 'inv' });
  await g.game.submit("check what I've got", { aimed: false });
  await g.game.settle();
  expect(g.game.state()!.turn).toBe(t);
  expect(g.game.lines().at(-1)?.kind).toBe('command');
  expect(g.claude.callsFor('narrator')).toHaveLength(0);
});
