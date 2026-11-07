// 5 Plan persistence: a trigger written on turn 3 fires on turn 7 without the Planner ordering it again.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import type { Trigger } from '../../src/types';
import { act, play, plannerOut } from './w4-kit';

it('5 Plan persistence', () => {
  const s = makeVillage();
  s.pending = { ...s.pending, turn: 3 };
  const trig: Trigger = { id: 'ambush_t7', ownerId: 'guard_1', when: { type: 'turn_reached', turn: 7 },
    then: { type: 'move', target: 'street_square', skill: null, intent: 'spring the ambush' }, once: true };
  play(s, { agentOutputs: [plannerOut('guard_1', act('hold'), { planUpdate: { goal: 'ambush', steps: [], triggers: [trig], memoryNote: 'waiting', routine: null } })] });
  expect(s.hidden.plans.guard_1.triggers.map((t) => t.id)).toEqual(['ambush_t7']);
  for (const turn of [4, 5, 6]) {
    play(s);
    expect(s.pending.fired).toEqual(turn === 6 ? ['ambush_t7'] : []);
  }
  const ev = play(s); // turn 7: no Planner output at all
  expect(ev.find((e) => e.actorId === 'guard_1')).toMatchObject({ kind: 'move', zone: 'street_square' });
  expect(s.hidden.firedLog).toEqual([{ triggerId: 'ambush_t7', turn: 7, ownerId: 'guard_1' }]);
  expect(s.hidden.plans.guard_1.triggers).toEqual([]);
});
