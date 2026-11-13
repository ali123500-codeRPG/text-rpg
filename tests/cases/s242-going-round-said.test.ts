// BG-148 (run 89c t39): the yard gate to the lane was locked (the player had tried it), so "out the gate to Mill Lane"
// walked round through the common room without a word. A walk that goes round a way straight there that the walker knows
// is shut says so: its move carries round (the way and why), and the Narrator tells it.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { zoneById } from '../../src/engine/relations';
import { buildNarrationView } from '../../src/views';
import { BK } from '../../src/library/tableIds';

it('going round a known locked way is said', () => {
  const s = makeVillage({ playerZone: 'tav_counter', without: ['slime_1', 'slime_2', 'guard_1', 'trader', 'patron_1'] });
  s.barriers = { gate: { id: 'gate', kind: BK.door, grade: 'minor', lock: { locked: true }, tried: ['player'] } };
  zoneById(s, 'tav_counter')!.links.push({ to: 'street_door', label: 'the yard gate', sight: false, barrier: 'gate' });
  zoneById(s, 'street_door')!.links.push({ to: 'tav_counter', label: 'the yard gate', sight: false, barrier: 'gate' });
  const ev = play(s, { intent: intent({ move: { toZone: 'street_door' } }) });
  const first = ev.find((e) => e.actorId === 'player' && e.kind === 'move')!;
  expect(first.round).toEqual({ way: 'the yard gate', shut: 'locked' });
  expect(buildNarrationView(s, ev).events.find((e) => e.id === first.id)?.round).toBe('the yard gate: locked');
});
