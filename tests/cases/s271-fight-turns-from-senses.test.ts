// 271 Nothing hidden (AT61 a): fight turns start only from what the player perceives: an attack on them, a foe after them
// they can see or hear, or a fight they can see or hear. A foe hunting them out of their senses keeps normal turns.
import { expect, it } from 'vitest';
import { actor, beside, makeVillage, place } from '../harness';
import { computePending } from '../../src/engine';
import { isEngaged } from '../../src/engine/relations';

const hunted = (where: 'beside' | 'cellar', status: 'hunting' | 'engaged' = 'hunting') => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const g = actor(s, 'guard_1');
  g.mind!.overrides = { player: 'hostile' };
  g.mind!.knowledge.player = { status, lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  if (where === 'beside') beside(s, 'guard_1', 'player', 2);
  else place(s, 'guard_1', 'tav_cellar');
  s.events = [];
  return s;
};

it('a foe after the player (hunting, or engaged after trading blows: BG-189) out of their senses keeps normal turns; one they can see starts fight turns', () => {
  const far = hunted('cellar');
  expect(isEngaged(far, far.player)).toBe(true); // the foe is after them all the same
  expect(computePending(far).mode).toBe('explore');
  expect(computePending(hunted('beside')).mode).toBe('tactical');
  // BG-189: a foe that traded blows with the player and went off out of their senses is no fight they can hear
  expect(computePending(hunted('cellar', 'engaged')).mode).toBe('explore'); // still engaged, standing quiet out of sight and earshot
  expect(computePending(hunted('beside', 'engaged')).mode).toBe('tactical');
});
