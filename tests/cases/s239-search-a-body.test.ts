// BG-152 (run 90b t40-42): the player stood 1 m from a dead slime and searched it three times; each time the search stayed
// at 1 m, beyond a hand's 0.7 m, and read "needs a hold on them". Someone who can't stop hands going through their things
// (down, dead, asleep, yielded, held) is searched hands-on: the searcher closes to grip reach first.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { handsOn } from '../../src/minds';

it('searching a body steps up to it and goes through it by hand', () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_2', 'guard_1', 'trader', 'patron_1'] });
  const t = beside(s, 'slime_1', 'player', 1);
  t.core.condition.hpLostPct = 105;
  expect(handsOn(s, s.player, t)).toBe(false);
  const ev = play(s, { intent: intent({ action: { type: 'search', target: t.id } }) });
  expect(handsOn(s, s.player, t)).toBe(true);
  const search = ev.find((e) => e.actorId === 'player' && e.kind === 'search')!;
  expect(search.effects.find((f) => f.kind === 'found_nothing')?.data.held).toBe(true);
});
