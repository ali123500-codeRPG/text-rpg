// BG-120: Wennick, standing beside the player (PLACE_GAP_M, 1 m), whispered his job offer and it went unheard: he stood
// 1.00005 m away and the lean-in check (WHISPER_REACH_M, 1 m) had no room for rounding. Every reach is now compared by
// one rule, withinM: whispers, grip, auras, attack and parry reach, closing in and stepping up.
import { expect, it } from 'vitest';
import type { AcceptedAgentOutput } from '../../src/engine';
import { createRng, makeVillage, place } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import { SK } from '../../src/library/skillIds';
import { act, intent, play } from './w4-kit';

it('BG-120: a whisper said from the standing gap beside the player is heard, rounding and all', () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
  s.zones.find((x) => x.id === 'tav_common')!.rect = { x: 0, y: 0, w: 12, d: 8 };
  const p = place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common';
  s.player.pos = { x: 0.99863, y: 0.0538 }; p.pos = { x: 0, y: 0 }; // 1.00008 m, as in run 77b
  const i = intent({ action: { type: 'talk', skill: SK.persuasion, target: p.id }, spoken: 'Go on, I am listening.', addressees: [p.id] });
  const sp = selectSpokespeople(s, i);
  const reply = { agent: 'responder', actorId: p.id, output: { action: act('talk', s.player.id), dialogue: { line: 'Quietly, please.', volume: 'whisper' }, gear: null, stance: null, planUpdate: null, reveals: [] } } as unknown as AcceptedAgentOutput;
  const ev = play(s, { intent: i, spokespeople: sp, exchange: resolveSpeech(s, i, sp, createRng(1)), agentOutputs: [reply] });
  const said = ev.find((e) => e.kind === 'speak' && e.actorId === p.id)!;
  expect(said.perception[s.player.id]?.heard).toBe(true);
});
