// 91 Gear ops are instant and cost no strain (less realism; they took 1 to 4 s each under AT11): a turn of them still holds the blow.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { DU } from '../../src/library/tableIds';
import { actionRow } from '../../src/ruleset/actionTime';
import { lineUsed } from '../../src/ruleset/fatigue';

const MAIN = new Set(['attack', 'wasted', 'equip', 'hold', 'speak', 'give', 'rest']);

it('91 Free gear ops', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  beside(s, 'patron_1'); // within a dagger's reach, so it is stabbed, not thrown
  s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger });
  s.zones.find((z) => z.id === 'tav_common')!.groundItems.push({ id: 'dg2', itemId: IT.dagger });
  const ev = play(s, { intent: intent({
    gear: [{ op: 'pick_up', item: 'dg2' }, { op: 'stow', item: `player_${IT.round_shield}_2` }, { op: 'draw', item: 'dg' }, { op: 'swap', item: 'dg2' }],
    action: { type: 'attack', target: 'patron_1', skill: SK.melee_light },
  }) });
  const mine = ev.filter((e) => e.actorId === 'player');
  expect(mine.some((e) => e.kind === 'attack')).toBe(true); // four gear ops take no time: the blow still comes
  const inv = Object.fromEntries(s.player.core.inventory.map((i) => [i.id, i.equippedIn]));
  expect(inv.dg2?.[0]).toMatch(/^grip:/);
  expect(inv.dg).toBeUndefined();
  expect(inv.player_arming_sword_1).toBeUndefined();
  // equip on armor is the main action
  const ev2 = play(s, { intent: intent({ action: { type: 'equip', item: `player_${IT.gambeson}_3` } }) });
  expect(ev2.filter((e) => e.actorId === 'player' && MAIN.has(e.kind)).map((e) => e.kind)).toEqual(['equip']);
  expect(s.player.core.inventory.find((i) => i.id === `player_${IT.gambeson}_3`)!.equippedIn).toBeUndefined();
});

it('91 changing gear, armour included, costs no strain and no time', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger });
  const before = lineUsed(s.player);
  play(s, { intent: intent({ gear: [{ op: 'stow', item: `player_${IT.round_shield}_2` }, { op: 'draw', item: 'dg' }] }) });
  play(s, { intent: intent({ action: { type: 'equip', item: `player_${IT.gambeson}_3` } }) });
  expect(lineUsed(s.player)).toBe(before);
  for (const id of [DU.draw, DU.stow, DU.swap, DU.pick_up_ground, DU.from_pack, DU.armor_heavy_on, DU.armor_heavy_off]) expect(actionRow(id)).toMatchObject({ seconds: 0, effort: 'base' });
});
