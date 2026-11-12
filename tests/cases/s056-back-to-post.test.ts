import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { desiredState, routineOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('56 Back to the post: walks back and takes up the zone and activity for the current turn', () => {
  const s = makeVillage();
  const g = place(s, 'guard_1', 'street_door'); // pulled off its post
  g.mind!.routine = { id: 'guard_post', anchorTurn: 0 };
  s.turn = 30;
  const seen: string[] = [];
  for (let i = 0; i < 3; i++, s.turn++) {
    const o = routineOrder(buildActorView(s, 'guard_1'));
    expect(o.source).toBe('routine');
    if (o.type === 'move') place(s, 'guard_1', o.target!);
    seen.push(`${o.type}:${g.zone}`);
  }
  expect(seen).toEqual(['move:street_square', 'move:gate_inner', 'idle:gate_inner']);
  expect(desiredState(buildActorView(s, 'guard_1'))).toEqual({ zone: 'gate_inner', activity: 'stand_watch' });
  expect(routineOrder(buildActorView(s, 'guard_1')).activity).toBe('stand_watch');
});
