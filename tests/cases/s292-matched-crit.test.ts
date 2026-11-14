// 292 D-292 Perfect Meets Perfect: the player and the other side of a contest land on the same tier, Critical Success or
// past it. One time; its reward opens one tier past Critical Success on every roll the holder makes as one side of a contest.
import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset, tierLevel } from '../../src/ruleset';
import { tierReach } from '../../src/ruleset/achRewards';
import { matchedCritFeat } from '../../src/engine/feats';
import { ACH } from '../../src/library/achievementIds';
import { TIERS } from '../../src/scales';
import { CONFIG } from '../../src/config';
import type { GameState, RollResult, Tier } from '../../src/types';

const roll = (actorId: string, tier: Tier, beyond?: number): RollResult =>
  ({ actorId, skill: 'awareness', d100: 50, margin: 80, tier, ...(beyond ? { beyond } : {}), natural: 0, modifiers: [], tierShifts: [] });
const contest = (a: RollResult, b: RollResult) => ({ a, b, gap: tierLevel(b) - tierLevel(a), winner: 'tie' as const });
const earned = (s: GameState) => (s.player.progression!.achievements ?? []).map((a) => a.key!);
// margin = d + 0.5 × skill + mods − 63.5; a d100 of 50 with no natural edge
const rollAt = (s: GameState, contest: boolean) => ruleset.roll({ actorId: 'player', skill: 'awareness', rollKind: 'hit',
  modifiers: [{ source: 'test', type: 'situational', value: 300 }], tierShifts: [], auto: false, ...(contest ? { contest: true as const } : {}) }, s, forcedRng([50]));
const setup = () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  CONFIG.GROWTH_AT_SCENARIO_END = false; // granted at once
  place(s, 'guard_1', 'tav_common');
  return s;
};

describe('292 matched critical in a contest', () => {
  it('only the same tier, Critical Success or past it, with the player on one side, earns it', () => {
    const s = setup();
    matchedCritFeat(s, contest(roll('player', 'critical_success'), roll('guard_1', 'great_success')));
    matchedCritFeat(s, contest(roll('player', 'great_success'), roll('guard_1', 'great_success')));
    matchedCritFeat(s, contest(roll('player', 'critical_success', 1), roll('guard_1', 'critical_success')));
    matchedCritFeat(s, contest(roll('guard_1', 'critical_success'), roll('patron_1', 'critical_success')));
    expect(earned(s)).not.toContain(ACH.matched_crit_1);
    matchedCritFeat(s, contest(roll('guard_1', 'critical_success'), roll('player', 'critical_success')));
    expect(earned(s)).toContain(ACH.matched_crit_1);
    matchedCritFeat(s, contest(roll('player', 'critical_success', 1), roll('guard_1', 'critical_success', 1)));
    expect(earned(s).filter((k) => k === ACH.matched_crit_1)).toHaveLength(1); // one time
  });

  it('its reward opens Critical Success+ on contest rolls only', () => {
    const s = setup();
    expect(tierReach(s.player, 'hit', true).up).toBe(0);
    matchedCritFeat(s, contest(roll('player', 'critical_success'), roll('guard_1', 'critical_success')));
    expect(tierReach(s.player, 'hit', true).up).toBe(1);
    expect(tierReach(s.player, 'hit').up).toBe(0);
    expect(tierReach(s.player, 'event').up).toBe(0);
    const inContest = rollAt(s, true), alone = rollAt(s, false);
    expect(inContest.margin).toBeGreaterThanOrEqual(CONFIG.MARGIN_BANDS[CONFIG.MARGIN_BANDS.length - 1] + CONFIG.TIER_EXTRA_BAND);
    expect(tierLevel(inContest)).toBe(TIERS.pos('critical_success') + 1);
    expect(tierLevel(alone)).toBe(TIERS.pos('critical_success'));
  });

  it('a real contest roll carries the contest flag', () => {
    const s = setup();
    matchedCritFeat(s, contest(roll('player', 'critical_success'), roll('guard_1', 'critical_success')));
    const c = ruleset.contested({ actorId: 'player', skill: 'awareness', modifiers: [{ source: 'test', type: 'situational', value: 300 }], tierShifts: [], auto: false },
      { actorId: 'guard_1', skill: 'awareness', modifiers: [], tierShifts: [], auto: false }, s, forcedRng([50, 50]));
    expect(tierLevel(c.a)).toBe(TIERS.pos('critical_success') + 1);
  });
});
