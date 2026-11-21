// BF16 (BG-188): someone who lets you search them is searched hands-on, finding all they carry; someone told to turn out
// their pockets can do it themselves (show), and may try to keep one thing back with a Filching roll. BF17: the guard
// template's Eyesight floor (the skill a search rolls) is 40, above a thief's.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { revealedTo } from '../../src/minds/state';
import { faceToward } from '../../src/engine/position';

const tavern = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const t = beside(s, 'trader', 'player', 0.5);
  t.core.inventory.push({ id: 'charm_1', itemId: IT.lucky_charm, qty: 1 } as never);
  return { s, t };
};
const searchHim = (s: ReturnType<typeof tavern>['s']) =>
  play(s, { intent: intent({ action: { type: 'search', target: 'trader' } as never }) }).find((e) => e.actorId === 'player' && e.kind === 'search')!;

it('BF16: a search of someone who let you goes through their things by hand and finds what they carry', () => {
  const { s, t } = tavern();
  expect(searchHim(s).effects.map((f) => f.kind)).not.toContain('found_items'); // only looked over
  t.letsSearch = { by: 'player', until: s.turn + 1 };
  const found = searchHim(s).effects.find((f) => f.kind === 'found_items');
  expect(found?.data.items).toContain('charm_1');
});

it('BF16: letting someone search you lasts this turn and the next; turning out your pockets shows what you carry to those who see it; one thing may be kept back by a Filching roll', () => {
  const { s, t } = tavern();
  s.player.core.inventory.push({ id: 'ring_1', itemId: IT.charmed_ring, qty: 1 } as never);
  play(s, { intent: intent({ action: null, letsSearch: 'trader' } as never) }); // the trader takes note of the player first
  expect(s.player.letsSearch).toEqual({ by: 'trader', until: s.turn + 1 });
  faceToward(t, s.player); // D-200: the trader (walked off on its routine) turns to watch; one facing away only glimpses
  const ev = play(s, { intent: intent({ action: { type: 'show' } as never }) }).find((e) => e.actorId === 'player' && e.kind === 'show')!;
  const shown = ev.effects.find((f) => f.kind === 'shown_items')!.data.items as string[];
  expect(shown).toContain('ring_1');
  expect(revealedTo(t, 'player')).toContain('item:ring_1');
  const { s: s2 } = tavern();
  s2.player.core.inventory.push({ id: 'ring_1', itemId: IT.charmed_ring, qty: 1 } as never);
  const ev2 = play(s2, { intent: intent({ action: { type: 'show', item: 'ring_1' } as never }) }).find((e) => e.actorId === 'player' && e.kind === 'show')!;
  const f = ev2.effects.find((x) => x.kind === 'shown_items')!.data;
  expect(ev2.roll?.skill).toBeDefined(); // the Filching roll
  expect((f.items as string[]).includes('ring_1')).toBe(!!f.palmFailed); // kept back unless seen
});
