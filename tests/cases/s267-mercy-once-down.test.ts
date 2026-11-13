// 267 Mercy once down (D-239). The player goes down in a lethal fight: a Claude-run foe of an Intelligent race that
// perceives it answers in its next output whether to spare (true) or finish; no answer finishes. Spared wakes at Critical
// somewhere safe (as a won survival roll) and counts for the stronger-foe survive chains, never the win chains.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { actor, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { healthLevel } from '../../src/ruleset';
import { buildActorView } from '../../src/views';
import { plannerActors } from '../../src/agents/game';
import { ACH } from '../../src/library/achievementIds';
import { finishers } from '../../src/engine/yield';

const codes = (s: GameState) => s.log.map((l) => l.code);
const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key!);

/** the guard (stronger than the player) fights the player to the death until the player goes down */
const downed = (control: 'agent' | 'code' = 'agent', lethal = true) => {
  const s = makeVillage({ playerZone: 'tav_common' }); // indoors: the lethal slimes out in the field can't sense the player
  const g = actor(s, 'guard_1');
  g.zone = 'tav_common';
  g.placeId = 'tavern';
  delete g.pos;
  s.bands.find((b) => b.id === g.bandId)!.lethal = lethal;
  g.mind!.control = control;
  g.mind!.overrides = { player: 'hostile' };
  g.mind!.knowledge.player = { status: 'engaged', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.player.core.condition.hpLostPct = 40; // a turn or two of fighting first, so the fight is on record
  s.mode = 'tactical'; // fight turns, as the game plays them (play() keeps the mode it is given)
  for (let i = 0; i < 40 && !codes(s).some((c) => ['mercy_asked', 'player_fell', 'survival_roll'].includes(c)); i++) play(s, { intent: intent({}), agentOutputs: [plannerOut('guard_1', act('attack', 'player'))] }, 201 + i); // seeds where the guard downs the player without a killing blow
  if (lethal) expect(healthLevel(s.player)).toBe('incapacitated');
  return s;
};
const answer = (spare?: boolean) => ({ intent: intent({}), agentOutputs: [plannerOut('guard_1', act('hold'), spare === undefined ? {} : { spare })] });

describe('267 mercy once down', () => {
  it('the foe is asked, and is the first planner called; sparing wakes the player at Critical, counted as survived, not won', () => {
    const s = downed();
    expect(codes(s)).toContain('mercy_asked');
    expect(codes(s)).not.toContain('player_fell');
    expect(s.mercy).toMatchObject({ pending: ['guard_1'], spared: [], finish: [] });
    expect(buildActorView(s, 'guard_1').self.playerAtMercy).toBe(true);
    expect(plannerActors(s)[0]).toBe('guard_1');
    play(s, answer(true));
    expect(codes(s)).toContain('player_spared');
    expect(s.mercy).toBeUndefined();
    expect(healthLevel(s.player)).toBe('critical');
    expect(s.stage.breakCause).toBe('knocked_out');
    expect(s.player.progression!.tally!.survived_above_pct).toBeGreaterThan(50);
    expect(earned(s)).toContain(ACH.survived_pct_50);
    expect(s.player.progression!.tally!.won_above_pct).toBeUndefined();
  });

  it('finishing, or no answer, ends the story', () => {
    for (const spare of [false, undefined]) {
      const s = downed();
      play(s, answer(spare));
      expect(codes(s)).toContain('player_fell');
      expect(s.mercy).toBeUndefined();
      expect(healthLevel(s.player)).toBe('incapacitated');
      expect(s.stage.breakCause).toBeUndefined();
    }
  });

  it('a code-run foe is not asked: the story ends at once', () => {
    const s = downed('code');
    expect(codes(s)).toContain('player_fell');
    expect(s.mercy).toBeUndefined();
  });

  it('a lethal foe that cannot sense the downed player does not finish them: the survival roll decides', () => {
    const s = downed('agent', false); // the guard's band is not lethal; the slimes out in the field are, but can't sense the player
    expect(finishers(s)).toEqual([]);
    expect(codes(s)).toContain('survival_roll');
    expect(codes(s)).not.toContain('player_fell');
  });
});
