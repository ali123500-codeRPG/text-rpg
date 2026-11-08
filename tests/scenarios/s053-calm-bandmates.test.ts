import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, switchRoutine, calmBandmatesSwitch, routineOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('53 Calm bandmates: one who heard follows the new routine next turn; one who did not keeps its own', () => {
  const s = makeVillage();
  const slots = { seat: 'tav_common', refuge: 'tav_cellar', exit: 'street_door' };
  for (const [id, zone] of [['patron_2', 'tav_common'], ['patron_3', 'street_square']] as const) {
    const p = spawnNpc(null, 'patron', { id, zone, placeId: zone.startsWith('tav') ? 'tavern' : 'street', bandId: 'tavern_folk' });
    installRoutines(p, 'patron', zone === 'tav_common' ? slots : { ...slots, seat: 'street_square' }, undefined, s.turn, createRng(7));
    s.actors.push(p);
  }
  // the Voice spokesperson's output switches its routine
  expect(switchRoutine(s, actor(s, 'patron_1'), 'leave_by_exit', 'agent')).toBe(true);
  const exchange: GameEvent = {
    id: 'ev_1', turn: s.turn, actorId: 'patron_1', kind: 'speak', zone: 'tav_common', effects: [], noise: 'quiet', visibility: 'normal',
    line: { text: "I'm off home.", volume: 'normal' }, perception: { patron_2: { level: 'full', cue: 'sight' }, player: { level: 'full', cue: 'sight' } },
  };
  calmBandmatesSwitch(s, 'patron_1', 'leave_by_exit', (id) => !!exchange.perception[id]);
  s.turn += 1;
  expect(actor(s, 'patron_2').mind!.routine!.id).toBe('leave_by_exit');
  expect(routineOrder(buildActorView(s, 'patron_2'))).toMatchObject({ type: 'move', target: 'street_door', source: 'routine' });
  expect(actor(s, 'patron_3').mind!.routine!.id).toBe('drink_at_seat');
});
