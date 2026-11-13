// BG-133 (run 90): Dov's refuge routine kept him "cowering" while he sat in the open on his log talking with the player
// 1 m away, so the narrator was told he was keeping out of sight. A look of keeping out of sight is not shown for
// someone in a talk who is not stealthy; someone stealthy, or not talking, keeps it.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage } from '../harness';
import { buildNarrationView } from '../../src/views';

it('BG-133: someone talking openly is never described as keeping out of sight', () => {
  const s = makeVillage();
  const t = s.actors.find((a) => a.id === 'patron_1')!;
  const cower: GameEvent = { id: 'c1', turn: 1, actorId: t.id, kind: 'idle', zone: t.zone, activity: 'cower', effects: [], noise: 'silent', visibility: 'close', perception: {} };
  cower.perception = { [s.player.id]: { level: 'full', cue: 'sight' } };
  const look = () => {
    const v = buildNarrationView(s, [cower], null);
    return [v.events.find((e) => e.id === 'c1')?.activityLook, v.actors.find((a) => a.label === t.label)?.activityLook];
  };
  expect(look()).toEqual(['keeping out of sight', 'keeping out of sight']);
  t.engagement = { start: 0, last: 1, kinds: ['talk'] };
  expect(look()).toEqual([undefined, undefined]);
  t.posture = 'stealthy';
  expect(look()[0]).toBe('keeping out of sight');
});
