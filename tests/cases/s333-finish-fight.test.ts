// IQ4 a, IQ6 a, IQ7 a: a fight far below the player (each foe's power at most a quarter of theirs, all together at most
// theirs) can be finished on code in one turn: the action list offers Finish the fight, and taking it plays the rounds
// to the end, handing the turn back on anything that is not a chore.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { farBelow, finishFight } from '../../src/engine';
import { power } from '../../src/engine/xp';
import { isActive } from '../../src/engine/relations';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import type { GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { now } from '../../src/time';
import { checkTurn, snapTurn } from '../../src/save/turnCheck';

const strike = (target: string) => intent({ action: { type: 'attack', target, skill: SK.melee_medium } });
/** the player at the gate with a hostile guard, after a first blow, so a fight is on */
function fight(): GameState {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.mind!.overrides = { player: 'hostile' };
  delete g.core.skills[SK.battle_sense]; // the seeded rounds below were set before guards had Battle Sense (its Reaction moves the blows)
  play(s, { intent: strike('guard_1') });
  s.mode = s.pending.mode;
  return s;
}
/** every skill the player has, times k */
const stronger = (s: GameState, k: number) => { for (const sk of Object.values(s.player.core.skills)) sk.raw *= k; };
const input = { intent: null, aimed: false, agentOutputs: [], spokespeople: [] };

describe('finishing a fight far below the player', () => {
  it('IQ6 a: far below only when each foe is at most a quarter of the player and all together at most the player', () => {
    const s = fight();
    expect(s.mode).toBe('tactical');
    expect(farBelow(s)).toBeNull(); // the start player is not far above a guard
    stronger(s, 10);
    const guard = s.actors.find((a) => a.id === 'guard_1')!;
    expect(power(s, guard)).toBeLessThanOrEqual(CONFIG.OUTCLASS_EACH * power(s, s.player));
    expect(farBelow(s)?.map((a) => a.id)).toEqual(['guard_1']);
    const all = CONFIG.OUTCLASS_ALL;
    try { CONFIG.OUTCLASS_ALL = power(s, guard) / power(s, s.player) / 2; expect(farBelow(s)).toBeNull(); } // too many together
    finally { CONFIG.OUTCLASS_ALL = all; }
    s.mode = 'explore';
    expect(farBelow(s)).toBeNull(); // only in a fight
  });

  it('IQ7 a: the action list offers Finish the fight only while the fight qualifies', () => {
    const s = fight();
    const kinds = () => deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions).map((a) => a.kind);
    expect(kinds()).not.toContain('finish');
    expect(buildPlayerView(s).player.finishable).toBeUndefined();
    stronger(s, 10);
    expect(buildPlayerView(s).player.finishable).toBe(true);
    const fin = deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions).find((a) => a.kind === 'finish')!;
    expect(fin.play({}).intent.finish).toBe(true);
    expect(kinds()).toContain('attack'); // turn by turn stays open: ignoring it plays as usual
  });

  it('IQ4 a: Finish the fight plays the rounds on code to the end in one turn, and the Narrator is told so', () => {
    const s = fight();
    stronger(s, 10);
    const turn = s.turn, t0 = now(s), before = snapTurn(s);
    const out = finishFight(s, input, createRng(3), strike);
    expect(out.stop).toBe('over');
    expect(checkTurn(s, before, out.events)).toEqual([]); // TQ1: every world rule holds across the rounds
    expect(out.rounds).toBeGreaterThan(1);
    expect(isActive(s.actors.find((a) => a.id === 'guard_1')!)).toBe(false);
    expect(s.turn).toBe(turn); // one turn
    expect(now(s)).toBeGreaterThan(t0);
    expect(out.events.filter((e) => e.kind === 'attack' && e.actorId === 'player').length).toBeGreaterThanOrEqual(out.rounds);
    expect(buildNarrationView(s, out.events).fightFinished).toEqual({ rounds: out.rounds, stop: 'the fight is over' });
  });

  it('IQ4 a: it hands the turn back when the player is hurt, a foe leaves the fight standing, or the fight stops qualifying', () => {
    const stops = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) { // fights are short: the guard wounds the player first in about one seed in forty
      const s = fight();
      stronger(s, 10);
      const guard = s.actors.find((a) => a.id === 'guard_1')!, lost = s.player.core.condition.hpLostPct;
      const out = finishFight(s, input, createRng(seed), strike);
      stops.add(out.stop);
      expect(['over', 'wounded', 'foe_out']).toContain(out.stop);
      if (out.stop === 'over') expect(isActive(guard)).toBe(false);
      if (out.stop === 'wounded') expect(s.player.core.condition.hpLostPct).toBeGreaterThan(lost);
      if (out.stop === 'foe_out') expect(isActive(guard)).toBe(true);
    }
    expect(stops).toContain('over');
    expect(stops).toContain('wounded');
    // no longer far below: nothing is played
    const s = fight();
    stronger(s, 10);
    stronger(s, 1 / 10);
    expect(finishFight(s, input, createRng(1), strike)).toMatchObject({ stop: 'no_longer', rounds: 0, events: [] });
  }, 20000); // twelve whole fights; each win levels the player, a new sheet whose combat level is worked out afresh (about 0.3 s)
});
