// BG-168 (run 100c step 36): the Narrator's text was refused twice for "sack" and "chest", everyday nouns that were also
// the names of items lying elsewhere, and the fallback said "You use item" for a bandage used up. One rule: only a name
// that tells which thing it is (a story-made item, a Threadbound one) is a leak; an event names its item by instance or by
// the item's own id.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { zoneById } from '../../src/engine/relations';
import { buildLeakContext, leakScan } from '../../src/agents/narration';
import { buildNarrationView } from '../../src/views';
import { IT } from '../../src/library/itemIds';

it('a catalog item lying elsewhere is an everyday noun, a story-made one is still a name', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  zoneById(s, 'tav_cellar')!.groundItems.push({ id: 'box', itemId: IT.chest }, { id: 'odd', itemId: 'bp_idol' });
  s.blueprints.push({ kind: 'item', id: 'bp_idol', data: { id: 'bp_idol', kind: 'misc', name: 'the jade idol', look: 'a jade idol', bulk: 0, value: 50 } } as never);
  const ctx = buildLeakContext(s);
  expect(leakScan('You set your chest against the door.', '{}', ctx)).toEqual([]);
  expect(leakScan('You think of the jade idol.', '{}', ctx)).toEqual(['name:the jade idol']);
});

it('a bandage used up is still named in the narration view', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  s.player.core.inventory.push({ id: 'band', itemId: IT.bandage, qty: 1 });
  s.player.core.condition.hpLostPct = 30;
  const ev = play(s, { intent: intent({ action: { type: 'use_item', item: 'band' } }) });
  const used = buildNarrationView(s, ev).events.find((e) => e.kind === 'use_item')!;
  expect(used.item).toBe('bandage');
});
