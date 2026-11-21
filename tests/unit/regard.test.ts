// D-206 (BN1–BN5): the regard score under a personal stance, its strength, Attachment and Forgivingness, and fading.
import { beforeEach, describe, expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { PA } from '../../src/library/tableIds';
import { DAY_MINUTES, advanceClock } from '../../src/time';
import { bandById, stance } from '../../src/engine/relations';
import { fadeStances, regardOf, setStanceWhole, stepOfRegard, strengthOf } from '../../src/engine/regard';
import { stepStance } from '../../src/engine/effects';
import type { Actor, GameState } from '../../src/types';

let s: GameState, g: Actor;
beforeEach(() => {
  s = makeVillage({ playerZone: 'street_square', without: ['slime_1', 'slime_2'] });
  g = actor(s, 'guard_1');
  bandById(s, g.bandId)!.relations[s.player.bandId] = 'neutral'; // the guard's band neither likes nor dislikes the player
  g.core.personality = { nerve: 0, traits: {}, values: [] };
  delete g.mind!.overrides; delete g.mind!.regard;
});
/** the guard holds `v` toward the player, kept for its step */
const hold = (v: number) => {
  g.mind!.overrides = { player: stepOfRegard(v) };
  g.mind!.regard = { player: { v, at: 0, step: stepOfRegard(v) } };
};
const days = (n: number) => { advanceClock(s, n * DAY_MINUTES); fadeStances(s); };
const traits = (t: Record<string, number>) => { g.core.personality = { nerve: 0, traits: t, values: [] }; };

describe('BN1 a: steps are bands on the score', () => {
  it('reads each edge toward neutral', () => {
    expect([-100, -76, -75, -46, -45, -16, -15, 15, 16, 45, 46, 75, 76, 100].map(stepOfRegard)).toEqual(
      ['hostile', 'hostile', 'opposed', 'opposed', 'unfriendly', 'unfriendly', 'neutral', 'neutral', 'friendly', 'friendly', 'friend', 'friend', 'loyal', 'loyal']);
  });
  it('one insult drops a friend at 60 to friendly, but a sworn brother at 74 stays a friend', () => {
    hold(60); stepStance(s, g, s.player, 'colder');
    expect(stance(s, g, s.player)).toBe('friendly');
    expect(regardOf(s, g, 'player')).toBe(40);
    hold(74); stepStance(s, g, s.player, 'colder');
    expect(stance(s, g, s.player)).toBe('friend');
    expect(regardOf(s, g, 'player')).toBe(54);
  });
  it('from a stance set whole, one step moves one whole step; more steps go 20 points each, so 30-point steps take more', () => {
    const seen = [1, 2, 3, 4].map(() => { stepStance(s, g, s.player, 'colder'); return stance(s, g, s.player); });
    expect(seen).toEqual(['unfriendly', 'unfriendly', 'opposed', 'hostile']); // −20, −40, −60, −80
  });
  it('a yielded actor steps from the middle of opposed (Q1)', () => {
    g.mind!.overrides = { player: 'yielded' };
    stepStance(s, g, s.player, 'colder');
    expect(stance(s, g, s.player)).toBe('hostile');
  });
  it('another writer changing the step leaves the old score unread: it reads the new step\'s middle', () => {
    hold(-20); g.mind!.overrides!.player = 'friend';
    expect(regardOf(s, g, 'player')).toBe(CONFIG.REGARD_MID.friend);
  });
});

describe('BN3 a: Attachment scales moves on bonds', () => {
  it('the attached bond fast and forgive friends; the detached the other way', () => {
    traits({ [PA.attachment]: 80 });
    stepStance(s, g, s.player, 'friendlier'); expect(regardOf(s, g, 'player')).toBeCloseTo(28);
    hold(60); stepStance(s, g, s.player, 'colder'); expect(regardOf(s, g, 'player')).toBeCloseTo(48);
    traits({ [PA.attachment]: -80 }); delete g.mind!.overrides; delete g.mind!.regard;
    stepStance(s, g, s.player, 'friendlier'); expect(regardOf(s, g, 'player')).toBeCloseTo(12);
    expect(stance(s, g, s.player)).toBe('neutral');
    hold(60); stepStance(s, g, s.player, 'colder'); expect(regardOf(s, g, 'player')).toBeCloseTo(32);
  });
  it('a colder move on a cold stance is not scaled', () => {
    traits({ [PA.attachment]: 80 });
    hold(-30); stepStance(s, g, s.player, 'colder'); expect(regardOf(s, g, 'player')).toBeCloseTo(-50);
  });
});

describe('BN2 a, BN4 a: grudges fade, bonds do not', () => {
  it('an insult fades back to neutral by day 6, and the override goes once the score is back at 0 (day 13)', () => {
    stepStance(s, g, s.player, 'colder');
    days(5.4); expect(stance(s, g, s.player)).toBe('unfriendly');
    days(0.1); expect(stance(s, g, s.player)).toBe('neutral');
    days(7.4); expect(g.mind!.overrides?.player).toBe('neutral');
    days(0.1); expect(g.mind!.overrides?.player).toBeUndefined();
  });
  it('an attack on itself is unfriendly from day 25, reaches its floor by day 32 and stays there', () => {
    setStanceWhole(s, g, 'player', 'hostile', true);
    days(24); expect(stance(s, g, s.player)).toBe('opposed');
    days(1); expect(stance(s, g, s.player)).toBe('unfriendly');
    days(7); expect(regardOf(s, g, 'player')).toBe(CONFIG.REGARD_MID.unfriendly);
    days(100); expect(stance(s, g, s.player)).toBe('unfriendly');
    expect(regardOf(s, g, 'player')).toBe(CONFIG.REGARD_MID.unfriendly);
  });
  it('an attack on a bandmate fades all the way', () => {
    setStanceWhole(s, g, 'player', 'hostile');
    days(60); expect(g.mind!.overrides?.player).toBeUndefined();
  });
  it('nothing fades before the pause', () => {
    setStanceWhole(s, g, 'player', 'hostile', true);
    days(CONFIG.FADE_PAUSE_DAYS); expect(regardOf(s, g, 'player')).toBe(CONFIG.REGARD_MID.hostile);
  });
  it('a bond never fades', () => {
    hold(60); days(200); expect(stance(s, g, s.player)).toBe('friend');
  });
  it('Forgivingness sets the rate: +60 is unfriendly by day 21, −100 never forgives', () => {
    traits({ [PA.forgivingness]: 60 });
    setStanceWhole(s, g, 'player', 'hostile', true);
    days(10); expect(stance(s, g, s.player)).toBe('opposed');
    days(11); expect(stance(s, g, s.player)).toBe('unfriendly');
    traits({ [PA.forgivingness]: -100 });
    setStanceWhole(s, g, 'player', 'hostile', true);
    days(300); expect(stance(s, g, s.player)).toBe('hostile');
  });
  it('a stance set whole by a cast starts its clock at the next turn end', () => {
    g.mind!.overrides = { player: 'unfriendly' };
    fadeStances(s); expect(g.mind!.regard?.player).toMatchObject({ v: CONFIG.REGARD_MID.unfriendly, step: 'unfriendly' });
    days(30); expect(g.mind!.overrides?.player).toBeUndefined();
  });
});

describe('BN5 a: strength by thirds of the step', () => {
  it('reads slight, plain or strong, and none for neutral or a band stance', () => {
    const at = (v: number) => { hold(v); return strengthOf(s, g, 'player'); };
    expect([50, 60, 70, -77, -88, -100, 88].map(at)).toEqual(['slight', 'plain', 'strong', 'slight', 'plain', 'strong', 'plain']);
    expect(at(5)).toBeUndefined();
    delete g.mind!.overrides; expect(strengthOf(s, g, 'player')).toBeUndefined();
  });
});

it('a yield turned opposed at a scenario\'s end keeps its attack: it fades only to unfriendly', () => {
  setStanceWhole(s, g, 'player', 'hostile', true);
  g.mind!.overrides!.player = 'opposed'; // as the scenario's end turns yielded into opposed
  fadeStances(s);
  expect(g.mind!.regard?.player).toMatchObject({ step: 'opposed', attacked: true });
  days(100); expect(stance(s, g, s.player)).toBe('unfriendly');
});
