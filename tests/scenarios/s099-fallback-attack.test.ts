import { expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import { fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { isEngaged } from '../../src/engine/relations';

it('99 Fallback attack: an engaged slime attacks the player with unarmed_natural, targetPart null, source fallback', () => {
  const s = makeVillage({ playerZone: 'field_mid' });
  const sl = actor(s, 'slime_1');
  sl.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'field_mid', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  expect(isEngaged(s, sl)).toBe(true);
  expect(fallbackOrder(buildActorView(s, 'slime_1'), createRng(1))).toMatchObject({
    actorId: 'slime_1', type: 'attack', target: 'player', skill: 'unarmed_natural', targetPart: null, aimed: false, source: 'fallback',
  });
});
