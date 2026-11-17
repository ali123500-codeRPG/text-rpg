// 344 What sneaking costs (VS8): a stealthy actor's time factor is SNEAK_TIME_MULT. Every action takes that many times as
// long, and movement too: its speed is divided by the same factor, so a walk covers that much less ground in the same time.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import type { GameState, Intent } from '../../src/types';
import { IT } from '../../src/library/itemIds';
import { DU } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import { actionRow, actionSeconds, timeFactor } from '../../src/ruleset/actionTime';
import { moveSpeed } from '../../src/engine/speed';
import { pickSeconds } from '../../src/ruleset';

const intent = (action: Partial<NonNullable<Intent['action']>>): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type: 'attack', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action },
});
const turn = (s: GameState, i: Intent, seed = 1) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };

describe('344 sneak time (VS8)', () => {
  it('the time factor is SNEAK_TIME_MULT while stealthy and 1 otherwise; speed is its inverse', () => {
    const s = makeVillage();
    const open = moveSpeed(s, s.player);
    expect(timeFactor(s.player)).toBe(1);
    s.player.posture = 'stealthy';
    expect(timeFactor(s.player)).toBe(CONFIG.SNEAK_TIME_MULT);
    const sneaking = moveSpeed(s, s.player);
    expect(sneaking.walk).toBeCloseTo(open.walk / CONFIG.SNEAK_TIME_MULT, 9);
    expect(sneaking.run).toBeCloseTo(open.run / CONFIG.SNEAK_TIME_MULT, 9);
    expect(pickSeconds(50, timeFactor(s.player))).toBeCloseTo(pickSeconds(50) * CONFIG.SNEAK_TIME_MULT, 9);
  });

  it('a stealthy archer looses fewer arrows over the same turns: each shot takes SNEAK_TIME_MULT times as long', () => {
    const shots = (stealthy: boolean) => {
      const s = makeVillage();
      place(s, 'player', 'field_edge');
      for (const i of s.player.core.inventory) delete i.equippedIn;
      s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
      s.mode = 'tactical';
      s.player.react = { s: 0, init: 100, turn: s.turn };
      if (stealthy) s.player.posture = 'stealthy';
      let n = 0;
      for (let i = 0; i < 5; i++) {
        s.actors.find((a) => a.id === 'slime_1')!.core.condition.hpLostPct = 0; // keep the target standing
        n += turn(s, intent({ target: 'slime_1' }), 10 + i).filter((e) => e.kind === 'attack' && e.actorId === 'player').length;
        if (stealthy) expect(s.player.posture).toBe('stealthy'); // a shot keeps you hidden
      }
      return n;
    };
    const shot = actionSeconds(actionRow(DU.bow_light)!);
    expect(shots(false)).toBe(Math.floor((5 * CONFIG.FIGHT_TURN_S) / shot));
    expect(shots(true)).toBe(Math.floor((5 * CONFIG.FIGHT_TURN_S) / (shot * CONFIG.SNEAK_TIME_MULT)));
  });

  it('a sneaking walk covers ground at 1 / SNEAK_TIME_MULT of the open speeds in a fight turn (a walk, then a dash)', () => {
    let openRun = 0;
    const walked = (sneak: boolean) => {
      const s = makeVillage();
      openRun = moveSpeed(s, s.player).run;
      place(s, 'player', 'field_edge');
      s.mode = 'tactical';
      s.player.react = { s: 0, init: 100, turn: s.turn };
      if (sneak) s.player.posture = 'stealthy';
      const ev = turn(s, { ...intent({}), action: null, move: { toZone: 'field_mid' } });
      return ev.filter((e) => e.kind === 'move' && e.actorId === 'player').reduce((n, e) => n + (e.metres ?? 0), 0);
    };
    const open = walked(false), sneaking = walked(true);
    // the move slot walks and the main slot dashes: walk × turn + (run − walk) × turn = run × turn
    expect(sneaking).toBeCloseTo((openRun / CONFIG.SNEAK_TIME_MULT) * CONFIG.FIGHT_TURN_S, 6);
    expect(sneaking).toBeLessThan(open); // open, the walker reached the next zone
  });
});
