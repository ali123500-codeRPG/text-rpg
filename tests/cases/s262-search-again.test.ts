// BG-178 (run 97f t44-47): the player searched Wen's body and found a key and coin, left them there, searched again and was
// told "nothing", while Bram's search the same turn found both. One rule: what a searcher found before and is still there
// is found again; a find reads as left where it is, never as taken.
import { expect, it } from 'vitest';
import { actor, beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { buildNarrationView } from '../../src/views';

it('searching someone again finds what is still on them', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = actor(s, 'patron_1');
  w.core.inventory.push({ id: 'roll', itemId: IT.bandage, qty: 1 });
  w.heldBy = 'player';
  beside(s, 'patron_1', 'player', 0.5);
  const search = () => play(s, { intent: intent({ action: { type: 'search', target: 'patron_1' } }), agentOutputs: [plannerOut('patron_1', act('hold'))] });
  const first = search();
  expect(buildNarrationView(s, first).events.flatMap((e) => e.changes ?? []).join(' ')).toContain('left there for now');
  const again = search().find((e) => e.kind === 'search' && e.actorId === 'player')!;
  expect(again.effects.find((f) => f.kind === 'found_items')?.data.items).toContain('roll');
  expect(again.effects.some((f) => f.kind === 'found_nothing')).toBe(false);
});
