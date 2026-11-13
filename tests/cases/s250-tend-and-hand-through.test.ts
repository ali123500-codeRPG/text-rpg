// BF13 (run 79b, BG-160): a healer could not bandage anyone but herself. A healing item used on someone within the user's
// grip reach heals them by its row, the same as on yourself, for the player and NPCs alike (closing in first: NEEDS), and
// NPCs can take things out of an open container, as the player can.
// BF12 (run 91b): hands pass a way you can see through (bars, a grate) even shut, never a shut door; handing something
// across a way, the one it is for steps up to their side of it to take it, as their move.
import { expect, it } from 'vitest';
import type { Barrier, GameState } from '../../src/types';
import { beside, byDoor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { actorById, zoneById } from '../../src/engine/relations';
import { buildActorView } from '../../src/views';
import { knownIds } from '../../src/agents/legality';
import { distM } from '../../src/engine/position';
import { IT } from '../../src/library/itemIds';
import { BK } from '../../src/library/tableIds';

const quiet = (zone = 'tav_common') => makeVillage({ playerZone: zone, without: ['slime_1', 'slime_2', 'guard_1'] });
const bandage = (s: GameState) => { s.player.core.inventory.push({ id: 'band', itemId: IT.bandage, qty: 2 }); };
const tend = (target: string) => intent({ action: { type: 'use_item', item: 'band', target } });

it('BF13: a bandage used on someone else heals them, after stepping up to them', () => {
  const s = quiet();
  bandage(s);
  const wim = beside(s, 'patron_1', 'player', 3);
  wim.core.condition.hpLostPct = 40;
  const ev = play(s, { intent: tend('patron_1') });
  expect(wim.core.condition.hpLostPct).toBeLessThan(40);
  expect(s.player.core.condition.hpLostPct).toBe(0);
  expect(ev.find((e) => e.kind === 'use_item')).toMatchObject({ actorId: 'player', target: 'patron_1' });
  expect(s.player.core.inventory.find((i) => i.id === 'band')!.qty).toBe(1);
});

it('BF13: an NPC can take what an open chest shows', () => {
  const s = quiet();
  zoneById(s, 'tav_common')!.groundItems.push({ id: 'box', itemId: IT.chest, open: true, contents: [{ id: 'roll', itemId: IT.bandage }] });
  expect(knownIds(buildActorView(s, 'patron_1')).ground.has('roll')).toBe(true);
});

function grate(s: GameState, kind: string = BK.grate): void {
  const bar: Barrier = { id: 'bars', kind, grade: 'minor', lock: { locked: true } };
  (s.barriers ??= {})[bar.id] = bar;
  zoneById(s, 'street_door')!.links.find((l) => l.to === 'tav_common')!.barrier = bar.id;
  zoneById(s, 'tav_common')!.links.find((l) => l.to === 'street_door')!.barrier = bar.id;
}
const handOver = () => intent({ action: { type: 'give', target: 'patron_1', item: 'player_coin', qty: 1 } });
const coinsOf = (s: GameState) => actorById(s, 'patron_1')!.core.inventory.find((i) => i.itemId === IT.coin)?.qty ?? 0;

it('BF12: through a locked grate the payment passes, the one paid stepping up to the bars', () => {
  const s = quiet('street_door');
  grate(s);
  byDoor(s, 'player', 'street_door', 'tav_common', 0.3);
  const wim = byDoor(s, 'patron_1', 'tav_common', 'street_door', 3);
  const before = coinsOf(s);
  play(s, { intent: handOver() });
  expect(coinsOf(s)).toBe(before + 1);
  expect(distM(s, s.player, wim)).toBeLessThan(1.5);
});

it('BF12: a locked solid door passes nothing, even arm to arm', () => {
  const s = quiet('street_door');
  grate(s, BK.door);
  byDoor(s, 'player', 'street_door', 'tav_common', 0.3);
  byDoor(s, 'patron_1', 'tav_common', 'street_door', 0.3);
  const before = coinsOf(s);
  const ev = play(s, { intent: handOver() });
  expect(coinsOf(s)).toBe(before);
  expect(ev.find((e) => e.kind === 'wasted' && e.actorId === 'player')?.reason).toBe('out_of_reach');
});
