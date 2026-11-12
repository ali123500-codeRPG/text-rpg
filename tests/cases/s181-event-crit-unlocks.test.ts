// 181 Event-roll criticals (D-211): a chain for Critical Success and one for Critical Failure on your event rolls. Each
// level is earned by reaching the tier the level below opened, and opens one more tier (tierUnlocks, summed along the
// chain and from perks). Each opened tier widens the natural critical range by EVENT_CRIT_NATURALS (Ali picked A).
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, tierName } from '../../src/ruleset';
import { tierReach } from '../../src/ruleset/achRewards';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import type { GameState } from '../../src/types';

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key!);
const ev = (s: GameState, d: number) => tierName(ruleset.eventRoll(s.player, s, forcedRng([d])));

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
  it('the Critical Failure chain mirrors it from 01 up', () => {
    const s = makeVillage();
    expect(ev(s, 1)).toBe('Critical Failure');
    expect(earned(s)).toEqual([ACH.event_crit_fail_1]);
    expect(getLibrary().achievements![ACH.event_crit_fail_1].scar).toBe(true);
    expect(ev(s, 8)).toBe('Critical Failure');
    expect(ev(s, 3)).toBe('Critical Failure−');
    expect(earned(s)).toEqual([ACH.event_crit_fail_2]);
    expect(ev(s, 2)).toBe('Critical Failure−−');
    expect(earned(s)).toEqual([ACH.event_crit_fail_3]);
  });
  it('a perk can open tiers too', () => {
    const s = makeVillage();
    getLibrary().perks.fated = { id: 'fated', name: 'Fated', tierUnlocks: [{ roll: 'any', side: 'up', steps: 1 }] };
    s.player.core.perks.push({ perkId: 'fated', source: 'level', gainedTurn: 0 });
    try { expect(ev(s, 97)).toBe('Critical Success+'); } finally { delete getLibrary().perks.fated; }
  });
});
