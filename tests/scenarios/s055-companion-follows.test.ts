import { expect, it } from 'vitest';
import { makeVillage, place, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, routineOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { shortestPath } from '../../src/engine/relations';

it('55 Companion follows one link per turn toward its believed zone, never jumping', () => {
  const s = makeVillage({ playerZone: 'street_square' });
  const c = spawnNpc(null, 'patron', { id: 'comp', zone: 'tav_common', placeId: 'tavern', bandId: 'player_band', name: 'Pip' });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  // the player moved two zones; the companion believes it is in the square
  c.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'street_square', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  const trail: string[] = [];
  for (let i = 0; i < 3; i++, s.turn++) {
    const o = routineOrder(buildActorView(s, 'comp'));
    if (o.type === 'move') {
      expect(shortestPath(s, c.zone, o.target!)).toHaveLength(1);
      place(s, 'comp', o.target!);
    }
    trail.push(c.zone);
  }
  expect(trail).toEqual(['street_door', 'street_square', 'street_square']);
});
