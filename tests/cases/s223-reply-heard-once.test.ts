// BG-132: "Stay right with me, we're taking the north road": Wennick, 1 m away, answered with a whispered line beside a
// move that was dropped. The line rode on two hold events, and as a bark with no listener it never got the whisper's
// lean-in, so the player heard nothing. A dialogue call's line is for the player whatever action carries it, and one
// order's words are said once a turn.
import { expect, it } from 'vitest';
import type { AcceptedAgentOutput } from '../../src/engine';
import { makeVillage } from '../harness';
import { act, play } from './w4-kit';

it('BG-132: a whispered reply carried by a dropped move is heard at arm\'s length, once', () => {
  const s = makeVillage({ playerZone: 'field_far', without: ['slime_1', 'slime_2', 'patron_1'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.zone = 'field_far'; g.placeId = 'field';
  s.zones.find((z) => z.id === 'field_far')!.rect = { x: 0, y: 0, w: 30, d: 30 };
  s.player.pos = { x: 0, y: 1 }; g.pos = { x: 0, y: 0 };
  g.mind!.control = 'agent';
  const reply = { agent: 'responder', actorId: g.id, output: { action: act('move', 'woods'), dialogue: { line: "Right, the north road. I'm coming.", volume: 'whisper' }, gear: null, stance: null, planUpdate: null, reveals: [] } } as unknown as AcceptedAgentOutput;
  const ev = play(s, { agentOutputs: [reply], spokespeople: [g.id] });
  const said = ev.filter((e) => e.actorId === g.id && e.line);
  expect(said).toHaveLength(1);
  expect(said[0].perception[s.player.id]?.heard).toBe(true);
});
