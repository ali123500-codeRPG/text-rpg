// BG-111: a spokesperson whispering an answer from 3 m away in a busy common room was never heard: its step-up move (spot
// beside the player) was walked as a move to the zone it already stood in, so it never moved. One rule (moveGoal) now
// turns every order's move into its goal, for the player, an NPC in turn and a spokesperson in the exchange.
import { expect, it } from 'vitest';
import type { AcceptedAgentOutput } from '../../src/engine';
import { createRng, makeVillage, place } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { act, intent, play } from './w4-kit';

it('BG-111: a spokesperson answering in a whisper from too far steps up beside the player first, and is heard', async () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
  const room = s.zones.find((x) => x.id === 'tav_common')!;
  room.rect = { x: 0, y: 0, w: 12, d: 8 };
  CONFIG.HEARING_FLOOR_DB = 25; // a busy room: a whisper is clear only within about a metre
  const p = place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common';
  s.player.pos = { x: 0, y: 2.9 }; p.pos = { x: 0, y: 0 };
  const i = intent({ action: { type: 'talk', skill: SK.persuasion, target: p.id }, spoken: 'What is your offer?', addressees: [p.id] });
  const sp = selectSpokespeople(s, i);
  expect(sp).toContain(p.id);
  const reply = { agent: 'responder', actorId: p.id, output: { action: act('talk', s.player.id), dialogue: { line: 'Quietly now: thirty coin.', volume: 'whisper' }, gear: null, stance: null, planUpdate: null, reveals: [] } } as unknown as AcceptedAgentOutput;
  const ev = play(s, { intent: i, spokespeople: sp, exchange: resolveSpeech(s, i, sp, createRng(1)), agentOutputs: [reply] });
  expect(ev.some((e) => e.kind === 'move' && e.actorId === p.id)).toBe(true);
  const said = ev.find((e) => e.kind === 'speak' && e.actorId === p.id)!;
  expect(said.perception[s.player.id]?.heard).toBe(true);
});
