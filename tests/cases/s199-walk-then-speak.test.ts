// BG-58: "walk over to her and ask..." walks first, then speaks from where the walk ends (as an NPC's reply does).
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

it('BG-58: the player walks to the one they talk to, then speaks from there', () => {
  const s = makeVillage({ playerZone: 'street_square', without: ['slime_1', 'slime_2', 'patron_1', 'trader'] });
  const i = intent({ action: { type: 'talk', skill: SK.persuasion, target: 'guard_1' }, spoken: 'Seen anyone leave in a hurry?', addressees: ['guard_1'], move: { toZone: 'gate_inner', spot: { near: 'guard_1' } } });
  const spokespeople = selectSpokespeople(s, i);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
  const ev = play(s, { intent: i, spokespeople, exchange, agentOutputs: [] });
  const said = ev.findIndex((e) => e.actorId === 'player' && e.kind === 'speak');
  const walked = ev.findIndex((e) => e.actorId === 'player' && e.kind === 'move');
  expect(walked).toBeGreaterThanOrEqual(0);
  expect(walked).toBeLessThan(said);
  expect(ev[said].zone).toBe('gate_inner');
  expect(s.player.zone).toBe('gate_inner');
});
