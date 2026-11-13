// BG-179 / BF14 a (run 79f t35): Brenn sat drinking in the tavern near people his band is hostile to; nobody struck anyone,
// yet the game went into fight turns, which dropped the player's words to Ness elsewhere. One rule: fight turns only while a
// fight concerns the player: a foe fighting them knows they are there, or they can perceive a fight going on.
import { expect, it } from 'vitest';
import { actor, beside, makeVillage } from '../harness';
import { computePending } from '../../src/engine';

const village = () => {
  const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2'] });
  actor(s, 'guard_1').mind!.overrides = { patron_1: 'hostile' };
  return s;
};

it('a standoff away from the player keeps normal turns', () => {
  const s = village();
  actor(s, 'guard_1').mind!.knowledge.patron_1 = { status: 'tracking', source: 'seen', revealed: [] };
  expect(computePending(s)).toMatchObject({ mode: 'explore', engaged: ['guard_1'] });
});

it('a fight the player can see is fight turns', () => {
  const s = village();
  s.player.zone = actor(s, 'patron_1').zone;
  beside(s, 'guard_1', 'patron_1', 1);
  beside(s, 'player', 'patron_1', 3);
  actor(s, 'guard_1').mind!.knowledge.patron_1 = { status: 'engaged', source: 'seen', revealed: [], closedTurn: s.turn };
  expect(computePending(s).mode).toBe('tactical');
});
