// 294 BG-206 (BF29): Happi went through the downed Wren hands on and found only his sack, not the charm inside it. A
// hands-on search now opens every unlocked container the person carries (containers in containers too), and what it
// finds can be taken from them. A locked one keeps its contents shut.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { IT } from '../../src/library/itemIds';

const downedWithSack = (locked = false) => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_2', 'guard_1', 'trader', 'patron_1'] });
  const t = beside(s, 'slime_1', 'player', 0.5);
  t.core.condition.hpLostPct = 105; // down
  t.core.inventory.push({ id: 'sack_1', itemId: IT.sack, ...(locked ? { lock: { locked: true } } : {}),
    contents: [{ id: 'pouch_1', itemId: IT.sack, contents: [{ id: 'charm_1', itemId: IT.lucky_charm }] }] });
  return { s, t };
};
const found = (ev: ReturnType<typeof play>) => ev.find((e) => e.kind === 'search')!.effects.filter((f) => f.kind === 'found_items').flatMap((f) => (f.data as { items?: string[] }).items ?? []);

it('a hands-on search finds what is inside the bags a downed man carries, and the find can be taken', () => {
  const { s, t } = downedWithSack();
  const ev = play(s, { intent: intent({ action: { type: 'search', target: t.id } }) });
  expect(s.player.journal!.revealed).toEqual(expect.arrayContaining(['item:sack_1', 'item:pouch_1', 'item:charm_1']));
  expect(found(ev).length).toBeGreaterThan(0);
  play(s, { intent: intent({ gear: [{ op: 'pick_up', item: 'charm_1', from: t.id }] }) });
  expect(s.player.core.inventory.some((i) => i.id === 'charm_1')).toBe(true);
});

it('a locked bag keeps what it holds shut', () => {
  const { s, t } = downedWithSack(true);
  play(s, { intent: intent({ action: { type: 'search', target: t.id } }) });
  expect(s.player.journal!.revealed).toContain('item:sack_1');
  expect(s.player.journal!.revealed).not.toContain('item:charm_1');
});
