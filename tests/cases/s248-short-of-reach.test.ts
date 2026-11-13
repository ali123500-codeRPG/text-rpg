// BG-163 (run 85d t28): "walk up to the gate and lift the latch" from 9.4 m: one move slot walks 8.4 m, so the player
// stopped a metre short of the gate's grip reach, as the rules say, but the story said the gate was "still a way off".
// One rule: every action wasted out of reach says how far short it fell (metres), and the Narrator tells a step as a step.
import { expect, it } from 'vitest';
import { byDoor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { slotMetres } from '../../src/engine/speed';
import { gripReachM } from '../../src/ruleset/body';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';

it('a way worked from just past one move slot ends a little short, and the wasted event says how far', () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_1', 'slime_2'] });
  const over = slotMetres(s, s.player, 'move') + gripReachM(s, s.player) + 0.5;
  byDoor(s, 'player', 'field_mid', 'field_edge', over);
  const ev = play(s, { intent: intent({ move: { toZone: 'field_mid', spot: { near: 'field_edge' } }, action: { type: 'interact', target: 'field_edge' } }) });
  const w = ev.find((e) => e.actorId === 'player' && e.kind === 'wasted')!;
  expect(w.reason).toBe('out_of_reach');
  expect(w.metres).toBeGreaterThan(0);
  expect(w.metres).toBeLessThan(1);
  expect(NARRATOR_INSTRUCTIONS).toContain('how far short of it they still are');
});
