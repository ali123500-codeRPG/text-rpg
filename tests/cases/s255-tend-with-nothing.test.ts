// BG-171 (run 79c t30-32): Ness, with nothing in her hands and her chest shut, ordered use_item on the player with no item;
// the turn showed a use with nothing in it, and she kept saying she was pressing the bandage. One rule: using an item one
// does not carry comes to nothing, with its reason (no_item); NPC prompts say a shut chest is opened first. And (run 98c t19)
// someone the player meant to go to, put off by the Parser after they left, is told as gone too (notThere).
import { expect, it } from 'vitest';
import { beside, makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { buildNarrationView } from '../../src/views';
import { lookAround } from '../../src/perception';
import { nameFor, actorById } from '../../src/engine/relations';
import { RESPONDER_INSTRUCTIONS } from '../../src/agents/prompts';

it('a use with no item carried is wasted, saying why', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  beside(s, 'patron_1', 'player', 0.5);
  const ev = play(s, { intent: intent({ action: { type: 'use_item', item: null, target: 'patron_1' } }) });
  expect(ev.find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('no_item');
  expect(ev.some((e) => e.kind === 'use_item')).toBe(false);
  expect(RESPONDER_INSTRUCTIONS).toContain('A shut one is opened first');
});

it('someone the player meant to go to, put off after they left, is told as not there', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  beside(s, 'patron_1', 'player', 2);
  lookAround(s);
  place(s, 'patron_1', 'street_square');
  const name = nameFor(s, s.player, actorById(s, 'patron_1')!) ?? actorById(s, 'patron_1')!.label;
  const i = intent({ action: null, deferred: [`walk over to ${name} and grab his wrist`] });
  const ev = play(s, { intent: i });
  expect(buildNarrationView(s, ev, i).notThere).toEqual([expect.stringContaining('last seen in')]);
});
