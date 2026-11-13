// BG-131: "Come on, stay with me": Wennick agreed and walked to stand beside the player in the street, but the player had
// already left it for the square this turn, so his spot was dropped and they crossed. A walk beside someone goes where
// that person is when the walk runs, while the walker still perceives them.
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { act, intent, plannerOut, play } from './w4-kit';

it('BG-131: an NPC walking over to the player follows them into the zone they just went to', () => {
  const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'patron_1'] });
  const g = place(s, 'guard_1', 'gate_inner');
  g.mind!.control = 'agent';
  const out = plannerOut(g.id, act('talk', s.player.id), { move: { toZone: 'street_door' }, dialogue: { line: "I'm right behind you.", volume: 'normal' } });
  play(s, { intent: { ...intent({ move: { toZone: 'gate_inner' } }), action: null }, agentOutputs: [out] });
  expect(s.player.zone).toBe('gate_inner');
  expect(g.zone).toBe('gate_inner');
  expect(s.log.some((l) => l.code === 'move_spot_dropped' && l.detail?.actorId === g.id)).toBe(false);
});
