import { expect, it } from 'vitest';
import { makeVillage, actor, place, createRng } from '../harness';
import { brokenOrder, fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('103 Broken flees: toward the exit slot one link, holds once there; a broken slime flees too (MB4)', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  const p = place(s, 'patron_1', 'tav_counter');
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  p.mind!.moraleState = 'broken';
  expect(brokenOrder(buildActorView(s, 'patron_1'))).toMatchObject({ type: 'flee', target: 'tav_common', source: 'broken' });
  place(s, 'patron_1', 'tav_common');
  expect(brokenOrder(buildActorView(s, 'patron_1'))).toMatchObject({ type: 'flee', target: 'street_door' });
  place(s, 'patron_1', 'street_door');
  expect(brokenOrder(buildActorView(s, 'patron_1')).type).toBe('hold');

  const sl = actor(s, 'slime_1');
  place(s, 'player', 'field_mid');
  sl.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'field_mid', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  sl.mind!.moraleState = 'broken'; // fearless is Resolve 90 now (MB4), so a slime can break
  expect(fallbackOrder(buildActorView(s, 'slime_1'), createRng(1)).type).toBe('flee');
});
