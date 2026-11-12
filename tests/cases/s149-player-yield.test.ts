// 149 The player's yield (MB40–MB43). In a real fight "I yield" asks every foe fighting the player; a Claude-run foe of
// an Intelligent race answers in its next output, the rest fight on. A taken yield is a truce for the scenario: neither
// side can attack the other, the fight ends, and it counts as lost.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { actor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { hostile } from '../../src/engine/relations';
import { CONFIG } from '../../src/config';
import { buildActorView, buildPlayerView } from '../../src/views';
import type { TurnInput } from '../../src/engine';

const fight = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const p = actor(s, 'patron_1');
  p.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.control = 'agent';
  return s;
};
const answer = (acceptYield: boolean | undefined) => ({
  agentOutputs: [{ agent: 'planner', actorId: 'patron_1', output: { action: { type: 'idle' }, dialogue: null, gear: null, stance: null, planUpdate: null, ...(acceptYield === undefined ? {} : { acceptYield }) } }],
}) as unknown as Partial<TurnInput>;
const tally = (s: GameState, k: string) => s.player.progression?.tally?.[k] ?? 0;
const codes = (s: GameState) => s.log.map((l) => l.code);

describe('149 the player yields', () => {
  it('MB40/MB41: the foe is asked; it answers next turn, and a taken yield is a truce that counts as a defeat', () => {
    const s = fight();
    play(s, { intent: intent({ spoken: 'Enough, I yield!', yields: true }) });
    expect(s.yielding).toMatchObject({ pending: ['patron_1'], accepted: [], refused: [] });
    expect(buildActorView(s, 'patron_1').self.playerYielded).toBe(true);
    expect(buildPlayerView(s).player.yielded?.waiting).toHaveLength(1);
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }), ...answer(true) });
    expect(codes(s)).toContain('yield_no_attack'); // MB43: the player waited on the answer and cannot strike
    expect(s.yielding).toMatchObject({ pending: [], accepted: ['patron_1'] });
    expect(hostile(s, actor(s, 'patron_1'), s.player)).toBe(false);
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) });
    expect(codes(s)).toContain('yield_no_attack'); // still barred
    for (let i = 0; i < CONFIG.ENGAGEMENT_END_TURNS && !s.log.some((l) => l.code === 'engagement_ended' && l.detail?.actorId === 'player'); i++) play(s, { intent: intent({}) });
    expect(tally(s, 'defeated')).toBe(1); // MB42: the fight ended, lost
  });

  it('MB41: no answer is a refusal; a code-run foe ignores the yield', () => {
    const s = fight();
    play(s, { intent: intent({ yields: true }) });
    play(s, { intent: intent({}), ...answer(undefined) });
    expect(s.yielding).toMatchObject({ pending: [], refused: ['patron_1'] });
    expect(hostile(s, actor(s, 'patron_1'), s.player)).toBe(true);
    const t = fight();
    actor(t, 'patron_1').mind!.control = 'code';
    play(t, { intent: intent({ yields: true }) });
    expect(t.yielding).toMatchObject({ pending: [], refused: ['patron_1'] });
  });
});
