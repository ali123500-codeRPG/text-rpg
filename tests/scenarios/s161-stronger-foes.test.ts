// 161 D-177 fights against a hostile foe stronger than you: power = rating + gear rating, on both sides. Surviving
// (on your feet at the end) and winning each have a chain by points above you (100/250/500) and one by % above (25/50/100).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { fightEnded, turnFeats } from '../../src/engine/feats';
import { gearRating, rating } from '../../src/engine/xp';
import { ACH } from '../../src/library/achievementIds';
import type { Actor, GameState } from '../../src/types';

const know = (a: Actor, b: Actor) => { a.mind!.knowledge[b.id] = { status: 'aware', lastKnownZone: b.zone, source: 'seen', revealed: [] }; };
const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key!);
const power = (s: GameState, a: Actor) => rating(a) + gearRating(s, a);

describe('161 stronger foes', () => {
  it('a fight turn records how far the strongest hostile foe is above you, in points and in %', () => {
    const s = makeVillage();
    const guard = actor(s, 'guard_1');
    guard.zone = s.player.zone;
    (guard.mind!.overrides ??= {})[s.player.id] = 'hostile';
    know(guard, s.player);
    s.player.engagement = { start: 1, last: 1, kinds: ['fight'] };
    turnFeats(s, []);
    const gap = power(s, guard) - power(s, s.player);
    expect(gap).toBeGreaterThan(25);
    expect(s.player.engagement.fight?.above).toBeCloseTo(gap, 5);
    expect(s.player.engagement.fight?.abovePct).toBeCloseTo((gap / power(s, s.player)) * 100, 5);
  });

  it('surviving counts the gap whether or not you won; winning also counts it on the win chains', () => {
    const s = makeVillage();
    fightEnded(s, { hp: 0, foes: ['guard_1'], most: 1, above: 300, abovePct: 30 }); // the guard is still up: not won
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.survived_above_250, ACH.survived_pct_25]));
    expect(earned(s)).not.toContain(ACH.survived_above_100); // replaced by the higher level
    expect(earned(s).some((k) => k === ACH.won_above_100 || k === ACH.won_pct_25)).toBe(false);
    fightEnded(s, { hp: 0, foes: [], most: 1, above: 600, abovePct: 110 }); // won
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.survived_above_500, ACH.survived_pct_100, ACH.won_above_500, ACH.won_pct_100]));
  });

  it('nothing for weaker foes, and nothing if you end the fight Down', () => {
    const s = makeVillage();
    fightEnded(s, { hp: 0, foes: [], most: 1, above: -10, abovePct: -10 });
    expect(earned(s).length).toBe(0);
    const t = makeVillage();
    t.player.core.condition.hpLostPct = 120; // Incapacitated
    fightEnded(t, { hp: 0, foes: [], most: 1, above: 200, abovePct: 200, down: true });
    expect(earned(t).some((k) => k === ACH.survived_above_100 || k === ACH.won_above_100)).toBe(false);
  });
});
