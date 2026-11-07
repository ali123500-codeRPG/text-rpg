// 15 Perception at the moment: a guard downed in step 2 perceives step 1's event and not step 3's.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';

it('15 Perception at the moment', () => {
  const s = makeVillage({ playerZone: 'street_square' });
  place(s, 'slime_1', 'gate_inner');
  const rng = createRng(1);
  const step = (e: GameEvent, after?: () => void) => {
    e.perception = computePerception(e, s, rng);
    after?.();
    updateBeliefs(s, { kind: 'event', event: e });
    return e;
  };
  const ev = (id: string, kind: string, actorId: string, target?: string): GameEvent =>
    ({ id, turn: 1, actorId, kind, zone: 'gate_inner', ...(target ? { target } : {}), effects: [], noise: 1, visibility: 2, perception: {} });
  const e1 = step(ev('e1', 'idle', 'slime_1'));
  const e2 = step(ev('e2', 'attack', 'slime_1', 'guard_1'), () => { actor(s, 'guard_1').core.condition.hpLostPct = 100; });
  const e3 = step(ev('e3', 'move', 'slime_1'));
  expect(e1.perception.guard_1).toBeDefined();
  expect(e2.perception.guard_1).toBeDefined(); // perceived as it happened, before the blow landed
  expect(e3.perception.guard_1).toBeUndefined();
  expect(actor(s, 'guard_1').mind!.knowledge.slime_1.lastSeenTurn).toBe(1);
});
