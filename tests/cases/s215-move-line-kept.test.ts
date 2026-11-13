// BG-118: Wren answered the player three turns running by fleeing toward the yard gate with a line, but the gate was an
// unbuilt frontier: he waited at its edge with his move spent and no event, so the line that rides on the move was lost.
// Words said with a move now always reach an event: the move's, a break-free, a way tried, or else one where he stands.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { headTo } from '../../src/minds';
import { act, plannerOut, play } from './w4-kit';

it('BG-118: a fleeing NPC that waits at an unbuilt frontier still says its line', () => {
  const s = makeVillage({ playerZone: 'field_far', without: ['slime_1', 'slime_2', 'patron_1'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.zone = 'field_far'; g.placeId = 'field'; delete g.pos;
  headTo(s, g, 'woods');
  g.mind!.control = 'agent';
  const ev = play(s, { agentOutputs: [plannerOut(g.id, act('flee', 'woods'), { dialogue: { line: 'Keep your distance.', volume: 'normal' } })] });
  expect(s.log.some((l) => l.code === 'frontier_wait' && l.detail?.actorId === g.id)).toBe(true);
  const said = ev.find((e) => e.actorId === g.id && e.line)!;
  expect(said.line!.text).toBe('Keep your distance.');
  expect(said.perception[s.player.id]?.heard).toBe(true);
});
