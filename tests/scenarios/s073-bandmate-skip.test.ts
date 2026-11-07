import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor } from '../harness';
import { switchRoutine, calmBandmatesSwitch } from '../../src/minds';

it("73 Bandmate skip: a calm bandmate whose list lacks the new routine keeps its own; routine_skip is logged", () => {
  const s = makeVillage();
  expect(switchRoutine(s, actor(s, 'patron_1'), 'leave_by_exit', 'agent')).toBe(true);
  const exchange: GameEvent = {
    id: 'ev_1', turn: s.turn, actorId: 'patron_1', kind: 'speak', zone: 'tav_common', effects: [], noise: 1, visibility: 2,
    line: { text: "I'm off.", volume: 'normal' }, perception: { trader: { level: 'full', cue: 'sight' } },
  };
  expect(calmBandmatesSwitch(s, 'patron_1', 'leave_by_exit', exchange)).toEqual([]);
  expect(actor(s, 'trader').mind!.routine!.id).toBe('tend_bar');
  expect(s.log).toContainEqual(expect.objectContaining({ code: 'routine_skip', detail: expect.objectContaining({ actorId: 'trader', routineId: 'leave_by_exit' }) }));
});
