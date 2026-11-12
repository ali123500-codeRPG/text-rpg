import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor } from '../harness';
import { desiredState, updateAlarms } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('62 Slots per actor: guard_post and its alert variant read the one post binding', () => {
  const s = makeVillage();
  const g = actor(s, 'guard_1');
  expect(Object.keys(g.mind!.slots!)).toEqual(['post']);
  expect(desiredState(buildActorView(s, 'guard_1'))!.zone).toBe('gate_inner');
  const attack: GameEvent = { id: 'ev_1', turn: s.turn, actorId: 'slime_1', kind: 'attack', zone: 'gate_inner', effects: [], noise: 'normal', visibility: 'normal', perception: { guard_1: { level: 'full', cue: 'sight' } } };
  updateAlarms(s, [attack]);
  expect(g.mind!.routine!.id).toBe('hold_post_alert');
  expect(desiredState(buildActorView(s, 'guard_1'))!.zone).toBe('gate_inner');
  expect(Object.keys(g.mind!.slots!)).toEqual(['post']);
});
