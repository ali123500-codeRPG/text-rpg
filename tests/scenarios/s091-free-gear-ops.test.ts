// 91 Free gear ops: a turn with draw, swap and pick up plus an attack resolves one main action; equip on armor takes the main action.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

const MAIN = new Set(['attack', 'wasted', 'equip', 'hold', 'speak', 'give', 'rest']);

it('91 Free gear ops', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  s.player.core.inventory.push({ id: 'dg', itemId: 'dagger' });
  s.zones.find((z) => z.id === 'tav_common')!.groundItems.push({ id: 'dg2', itemId: 'dagger' });
  const ev = play(s, { intent: intent({
    gear: [{ op: 'pick_up', item: 'dg2' }, { op: 'stow', item: 'player_round_shield_2' }, { op: 'draw', item: 'dg' }, { op: 'swap', item: 'dg2' }],
    action: { type: 'attack', target: 'patron_1', skill: SK.melee_light },
  }) });
  const mine = ev.filter((e) => e.actorId === 'player');
  expect(mine.filter((e) => MAIN.has(e.kind))).toHaveLength(1);
  expect(mine.find((e) => MAIN.has(e.kind))!.kind).toBe('attack');
  const inv = Object.fromEntries(s.player.core.inventory.map((i) => [i.id, i.equippedIn]));
  expect(inv.dg2?.[0]).toMatch(/^hand:/);
  expect(inv.dg).toBeUndefined();
  expect(inv.player_arming_sword_1).toBeUndefined();
  // equip on armor is the main action
  const ev2 = play(s, { intent: intent({ action: { type: 'equip', item: 'player_gambeson_3' } }) });
  expect(ev2.filter((e) => e.actorId === 'player' && MAIN.has(e.kind)).map((e) => e.kind)).toEqual(['equip']);
  expect(s.player.core.inventory.find((i) => i.id === 'player_gambeson_3')!.equippedIn).toBeUndefined();
});
