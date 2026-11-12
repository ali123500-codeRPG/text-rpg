// 97 Concealed blade: an NPC's view omits a concealed blade until the NPC perceives an attack with it; after that its belief keeps it.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import { buildActorView } from '../../src/views';
import { IT } from '../../src/library/itemIds';

it('97 Concealed blade', () => {
  const s = makeVillage();
  actor(s, 'patron_1').core.inventory.push({ id: 'blade_1', itemId: IT.hidden_blade, equippedIn: ['grip:right_arm'] });
  const gearSeen = () => buildActorView(s, 'trader').seen.find((x) => x.id === 'patron_1')?.gear.map((g) => g.id) ?? [];
  // trader behind the bar sees the common room through a sight link
  expect(buildActorView(s, 'trader').seen.some((x) => x.id === 'patron_1')).toBe(true);
  expect(gearSeen()).not.toContain('blade_1');

  const e: GameEvent = { id: 'a1', turn: 1, actorId: 'patron_1', kind: 'attack', zone: 'tav_common', target: 'slime_1', itemId: 'blade_1', effects: [], noise: 'normal', visibility: 'normal', perception: {} };
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  s.events.push(e);
  expect(gearSeen()).toContain('blade_1');

  // later turns: the event is gone, the belief keeps the reveal
  s.events = [];
  s.turn = 5;
  expect(gearSeen()).toContain('blade_1');
  expect(actor(s, 'trader').mind!.knowledge.patron_1.revealed).toContain('item:blade_1');
  // an actor that did not perceive it still doesn't see the blade
  expect(buildActorView(s, 'guard_1').seen.find((x) => x.id === 'patron_1')).toBeUndefined();
});
