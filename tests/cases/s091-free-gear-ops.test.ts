// 91 Gear ops are instant and cost no strain (less realism; they took 1 to 4 s each under AT11): a turn of them still holds the blow.
// Armor on or off is one of them (it was the turn's main action under AE10).
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { DU } from '../../src/library/tableIds';
import { actionRow } from '../../src/ruleset/actionTime';
import { lineUsed } from '../../src/ruleset/fatigue';
import { layAll } from '../harness';

const MAIN = new Set(['attack', 'wasted', 'hold', 'speak', 'give', 'rest']);

it('91 Free gear ops', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  beside(s, 'patron_1'); // within a dagger's reach, so it is stabbed, not thrown
  s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger });
  layAll(s, 'tav_common', { id: 'dg2', itemId: IT.dagger });
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
  // armor on or off is free too: taken off beside the attack, the blow still comes
  const ev2 = play(s, { intent: intent({ gear: [{ op: 'armor', item: `player_${IT.gambeson}_3` }], action: { type: 'attack', target: 'patron_1', skill: SK.melee_light } }) });
  const mine2 = ev2.filter((e) => e.actorId === 'player');
  expect(mine2.some((e) => e.kind === 'equip')).toBe(true);
  expect(mine2.some((e) => e.kind === 'attack')).toBe(true);
  expect(s.player.core.inventory.find((i) => i.id === `player_${IT.gambeson}_3`)!.equippedIn).toBeUndefined();
});

it('91 changing gear, armour included, costs no strain and no time', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger });
  const before = lineUsed(s.player);
  play(s, { intent: intent({ gear: [{ op: 'stow', item: `player_${IT.round_shield}_2` }, { op: 'draw', item: 'dg' }] }) });
  play(s, { intent: intent({ gear: [{ op: 'armor', item: `player_${IT.gambeson}_3` }] }) });
  expect(lineUsed(s.player)).toBe(before);
  // armor that can't go on (a weapon named) comes to nothing and says why (BG-149)
  const ev = play(s, { intent: intent({ gear: [{ op: 'armor', item: 'dg' }] }) });
  expect(ev.find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('cannot_put_that_on');
  for (const id of [DU.draw, DU.stow, DU.swap, DU.pick_up_ground, DU.from_pack, DU.armor_heavy_on, DU.armor_heavy_off]) expect(actionRow(id)).toMatchObject({ seconds: 0, effort: 'base' });
});

it('91 an NPC follows the same rule: armor on beside its attack, and the blow still comes', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  beside(s, 'patron_1');
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.core.inventory.push({ id: 'coat', itemId: IT.gambeson });
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.mode = 'tactical';
  const ev = play(s, { agentOutputs: [plannerOut('patron_1', act('attack', 'player', { skill: SK.unarmed_improvised }), { gear: [{ op: 'armor', item: 'coat' }] })] });
  const its = ev.filter((e) => e.actorId === 'patron_1').map((e) => e.kind);
  expect(its).toContain('equip');
  expect(its).toContain('attack');
  expect(p.core.inventory.find((i) => i.id === 'coat')!.equippedIn).toEqual(['armor']);
});
