// BF3 (BG-120 part 2): Maud answered from behind her counter in a whisper, but the player stood about 5 m back and heard
// nothing. A whisper to someone it does not reach, even after stepping up, is said low instead: the quietest sound up
// to normal speech that the listener hears clearly (logged whisper_raised, so playtests show how often agents misjudge).
import { expect, it } from 'vitest';
import type { AcceptedAgentOutput } from '../../src/engine';
import { makeVillage } from '../harness';
import { act, play } from './w4-kit';
import { distM } from '../../src/engine/position';
import { NOISE } from '../../src/scales';

it('BF3: a whispered answer across the counter to someone standing back is heard, said low', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'] });
  const m = s.actors.find((a) => a.id === 'trader')!;
  const common = s.zones.find((z) => z.id === 'tav_common')!.rect!;
  const counter = s.zones.find((z) => z.id === 'tav_counter')!.rect!;
  // the far side of the common room from the counter
  s.player.pos = { x: common.x - Math.sign(counter.x - common.x) * (common.w / 2 - 0.5), y: common.y - Math.sign(counter.y - common.y) * (common.d / 2 - 0.5) };
  expect(distM(s, s.player, m)).toBeGreaterThan(3);
  m.mind!.control = 'agent';
  const reply = { agent: 'responder', actorId: m.id, output: { action: act('talk', s.player.id), dialogue: { line: 'Not here. Come round the back.', volume: 'whisper' }, gear: null, stance: null, planUpdate: null, reveals: [] } } as unknown as AcceptedAgentOutput;
  const ev = play(s, { agentOutputs: [reply], spokespeople: [m.id] });
  const said = ev.find((e) => e.actorId === m.id && e.line)!;
  expect(said.perception[s.player.id]?.heard).toBe(true);
  expect(NOISE.pos(said.noise)).toBeGreaterThan(NOISE.pos('hushed'));
  expect(NOISE.pos(said.noise)).toBeLessThanOrEqual(NOISE.pos('normal'));
  expect(s.log.some((l) => l.code === 'whisper_raised')).toBe(true);
});
