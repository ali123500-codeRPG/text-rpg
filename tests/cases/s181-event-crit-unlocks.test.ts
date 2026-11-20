// 181 Event-roll criticals (D-211): a chain for Critical Success and one for Critical Failure on your event rolls. Each
// level is earned by reaching the tier the level below opened, and opens one more tier (tierUnlocks, summed along the
// chain and from perks). Each opened tier widens the natural critical range by EVENT_CRIT_NATURALS (option A).
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, tierName } from '../../src/ruleset';
import { tierReach } from '../../src/ruleset/achRewards';
import { ACH } from '../../src/library/achievementIds';
import type { GameState } from '../../src/types';
import { atScenarioEnd, grantAchievement } from '../../src/engine/xp';

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key!);
const grantHeld = (s: GameState) => atScenarioEnd(() => {
  const pr = s.player.progression!, q = pr.pendingAchievements ?? [];
  delete pr.pendingAchievements;
  for (const x of q) grantAchievement(s, x.key, x.of, x.reached, true, x.turn);
});
/** an event roll, then the end of the scenario it opens: what the roll earned is granted there (BG-272) */
const ev = (s: GameState, d: number) => { const t = tierName(ruleset.eventRoll(s.player, s, forcedRng([d]))); grantHeld(s); return t; };

describe('181 event-roll criticals open tiers past Critical', () => {
  it('without an unlock a natural 00 stops at Critical Success and earns level 1', () => {
    const s = makeVillage();
    expect(ev(s, 91)).toBe('Great Success');
    expect(ev(s, 100)).toBe('Critical Success');
    expect(earned(s)).toEqual([ACH.event_crit_1]);
  });
  it('level 1 opens Critical Success+: 96-100 reach it and 91-95 become Critical Success', () => {
    const s = makeVillage();
    ev(s, 100);
    expect(ev(s, 92)).toBe('Critical Success');
    expect(earned(s)).toEqual([ACH.event_crit_1]); // Critical Success again earns nothing new
    expect(ev(s, 96)).toBe('Critical Success+');
    expect(earned(s)).toEqual([ACH.event_crit_2]); // one Critical Success+ earns level 2
    expect(tierReach(s.player, 'event')).toEqual({ up: 2, down: 0 });
    expect(ev(s, 87)).toBe('Critical Success');
    expect(ev(s, 93)).toBe('Critical Success+');
    expect(ev(s, 99)).toBe('Critical Success++');
    expect(earned(s)).toEqual([ACH.event_crit_3]);
    expect(tierReach(s.player, 'hit')).toEqual({ up: 0, down: 0 }); // event rolls only
  });
});
