// 206 Scenario-end growth (growth proposal EG7, EG8, EG10, EG13, EG17 a, the rounds rule): marks only count while a scenario
// runs; at its end it pays round(owed × tier share × ending factor) improvement rolls (+ past Critical Success, + the low-level
// bonus), dealt to the marked skills by their marks and made in rounds with Burden worked out again each round. Levels wait too.
import { afterEach, describe, expect, it } from 'vitest';
import type { GameState, Rng, ScenarioEnding } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { closeScenario, endScenario, frameOf } from '../../src/engine/scenarioEnd';
import { dealRolls, scenarioGainsNow, scenarioRolls } from '../../src/engine/growth';
import { payRolls } from '../../src/ruleset/improve';
import { awardXp, charLevel, xpToNext } from '../../src/engine/xp';

const cfg = CONFIG as unknown as { ENDING_FACTOR: Record<string, number> };
afterEach(() => { cfg.ENDING_FACTOR.resolved = 1; });
const frame = (s: GameState, scale = 'situation', tier = 'success') =>
  (s.stage.scenario = frameOf(s, { question: 'q', scale, endings: [] }, tier as never, (_k, r) => r));
const end = (s: GameState, as: ScenarioEnding, rng?: Rng) => { endScenario(s, as, ''); return closeScenario(s, rng); };
/** a die that always shows `d` and gains the most */
const fixed = (d: number): Rng => ({ state: 1, next: () => 0.5, int: (_lo, hi) => hi, d100: () => d });
const level = (s: GameState, n: number) => { s.player.core.classes[0].level = n; };

describe('206 scenario-end payout', () => {
  it('pays round(owed × tier share × ending factor), plus a roll per step past Critical Success and below level 5', () => {
    const s = makeVillage();
    level(s, 6);
    expect(scenarioRolls(s, 10, 'success', undefined, 'resolved')).toBe(8);
    expect(scenarioRolls(s, 10, 'critical_failure', undefined, 'left')).toBe(3); // 10 × 0.5 × 0.5 = 2.5
    expect(scenarioRolls(s, 10, 'critical_success', 2, 'lost')).toBe(10); // 7.5 + 2
    expect(scenarioRolls(s, 0, 'critical_success', 3, 'resolved')).toBe(0); // nothing marked pays nothing
    level(s, 1);
    expect(scenarioRolls(s, 10, 'success', undefined, 'resolved')).toBe(9);
  });

  it('EG17 a: an ending factor outside ENDING_FACTOR_MIN..MAX is kept inside them', () => {
    const s = makeVillage();
    level(s, 6);
    cfg.ENDING_FACTOR.resolved = 5;
    expect(scenarioRolls(s, 10, 'success', undefined, 'resolved')).toBe(10); // 10 × 0.8 × 1.25
    expect(scenarioRolls(s, 10, 'success', undefined, 'no_such' as ScenarioEnding)).toBe(4); // unknown: the minimum
  });

  it('deals rolls by marks, largest remainder first', () => {
    expect(dealRolls([[SK.dodge, 6], [SK.block, 3], [SK.endurance, 1]], 5)).toEqual([[SK.dodge, 3], [SK.block, 2]]);
    expect(dealRolls([[SK.dodge, 1], [SK.block, 1]], 3)).toEqual([[SK.dodge, 2], [SK.block, 1]]);
  });

  it('rolls in rounds: Burden is worked out again after each round', () => {
    const s = makeVillage(), p = s.player, pr = p.progression!;
    p.core.skills[SK.dodge] = { raw: 50, state: 'normal' };
    p.core.skills[SK.block] = { raw: 10, state: 'normal' };
    const total = Object.values(p.core.skills).filter((x) => x.state !== 'tagged').reduce((n, x) => n + x.raw, 0);
    pr.potential = { base: total - (CONFIG.K - 1), adjustments: [] }; // Burden 0 now, 1 after any 3+3
    const gains = payRolls(s, fixed(43), [[SK.dodge, 2], [SK.block, 1]]);
    // round 1: dodge 43 + 50 − 90 = 3, Success: 50 → 53; block 43 + 90 − 90 = 43, Great Success: 10 → 14.
    // round 2: Burden is now 1, so dodge's margin is 43 + (100 − 53 − 1) − 90 = −1 and it gains nothing (with the old Burden it would)
    expect(gains.map((g) => [g.skill, g.to])).toEqual([[SK.dodge, 53], [SK.block, 14]]);
  });

  it('marks wait for the end; the end pays them, levels up, and the summary shows both', () => {
    const s = makeVillage(), p = s.player, pr = p.progression!;
    p.core.skills[SK.dodge] = { raw: 30, state: 'normal' };
    frame(s);
    pr.marks = [SK.dodge, SK.dodge, SK.dodge, SK.dodge];
    const lv = charLevel(p);
    awardXp(s, xpToNext(p), 'test');
    expect(charLevel(p)).toBe(lv); // EG8: the level waits
    expect(p.core.skills[SK.dodge].raw).toBe(30);
    end(s, 'resolved', fixed(100));
    expect(pr.marks).toEqual([]);
    expect(charLevel(p)).toBe(lv + 1);
    const g = scenarioGainsNow(s)!;
    expect(g.levelUps).toHaveLength(1);
    // 4 owed × 0.8 × 1 = 3 (+1 below level 5) = 4 rolls on a d100 of 100: margins 80, 75 (Critical, +5 each), 70, 66 (Great, +4 each)
    expect(g.skills).toEqual([{ skill: SK.dodge, from: 30, to: 48 }]);
    expect(s.log.some((l) => l.code === 'growth_paid')).toBe(true);
  });

  it('marks made in free roam wait and are paid by the next scenario', () => {
    const s = makeVillage(), pr = s.player.progression!;
    s.player.core.skills[SK.dodge] = { raw: 30, state: 'normal' };
    pr.marks = [SK.dodge];
    expect(s.player.core.skills[SK.dodge].raw).toBe(30);
    frame(s);
    end(s, 'resolved', fixed(100));
    expect(s.player.core.skills[SK.dodge].raw).toBeGreaterThan(30);
  });

  it('SC4: an inner scenario pays only its own marks; the bigger one keeps its own until it ends', () => {
    const s = makeVillage(), p = s.player, pr = p.progression!;
    level(s, 6);
    p.core.skills[SK.dodge] = { raw: 30, state: 'normal' };
    p.core.skills[SK.block] = { raw: 30, state: 'normal' };
    frame(s, 'episode');
    pr.marks = [SK.dodge, SK.dodge];
    s.stage.breakCause = 'encounter';
    expect(closeScenario(s, fixed(100))).toBe('new');
    expect(p.core.skills[SK.dodge].raw).toBe(30); // the episode paid nothing yet
    expect(pr.marks).toEqual([]);
    s.stage.scenarioNumber += 1;
    frame(s, 'moment');
    pr.marks = [SK.block, SK.block];
    expect(end(s, 'resolved', fixed(100))).toBe('resume');
    expect(p.core.skills[SK.block].raw).toBeGreaterThan(30);
    expect(p.core.skills[SK.dodge].raw).toBe(30);
    expect(pr.marks).toEqual([SK.dodge, SK.dodge]); // the episode's come back
    end(s, 'resolved', fixed(100));
    expect(p.core.skills[SK.dodge].raw).toBeGreaterThan(30);
  });
});
