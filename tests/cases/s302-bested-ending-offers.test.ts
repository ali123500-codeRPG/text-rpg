// 302 BS1-BS3, TF20 b, EB1, EB3 ("Essences: bested foes, extraction, balance"): bested = defeated, or talked or bribed out of
// a fight by the player (stand-downs from the player's offer), once per person, ever; the running scenario lists them and the
// Bested chain counts them from reward level −2. A resolved Great Success ending offers two essences from the bested (one
// from anyone, one from the 3 strongest), each measured from that person; taking one lets the other go. The first three
// essence changes cost no XP.
import { expect, it } from 'vitest';
import type { GameState, Rng } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { ES } from '../../src/library/essenceIds';
import { bested, power, xpToNext } from '../../src/engine/xp';
import { standDown } from '../../src/engine/offer';
import { offerAtEnding, passEssence, removeEssence, rowsFor, takeEssence } from '../../src/engine/essence';
import { frameOf } from '../../src/engine/scenarioEnd';
import { rewardXp } from '../../src/ruleset/achRewards';

const dice = (...d: number[]): Rng => { let i = 0; return { state: 1, next: () => 0, int: (lo) => lo, d100: () => d[Math.min(i++, d.length - 1)] }; };
const has = (s: GameState, key: string) => [...(s.player.progression!.achievements ?? []), ...(s.player.progression!.pendingAchievements ?? [])].some((a) => a.key === key); // granted at the scenario's end
const actor = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const withFrame = (s: GameState) => (s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'great_success', (_k, r) => r));

it('BS2/BS3: being bested lists the person once, ever, and the Bested chain starts at −2 (no XP by the one curve)', () => {
  const s = makeVillage(), f = withFrame(s), g = actor(s, 'guard_1');
  bested(s, g);
  bested(s, g);
  expect(f.bested).toEqual(['guard_1']);
  expect(has(s, ACH.bested_1)).toBe(true);
  expect(rewardXp('minus_2')).toBe(0);
  expect(rewardXp('minus_1')).toBe(6);
});

it('BS1: a foe that stands down from the player\'s offer is bested; the player taking a foe\'s offer bests no one', () => {
  const s = makeVillage(), f = withFrame(s);
  standDown(s, actor(s, 'patron_1'), s.player, []);
  expect(f.bested).toContain('patron_1');
  standDown(s, s.player, actor(s, 'guard_1'), []);
  expect(f.bested).not.toContain('guard_1');
});

it('EB1: an ending offers two from the bested, one from anyone and one from the strongest, each measured from that person; taking one lets the other go, passing keeps it', () => {
  const s = makeVillage(), f = withFrame(s);
  const ids = s.actors.filter((a) => a !== s.player && rowsFor(s, a).length).map((a) => a.id);
  expect(ids.length).toBeGreaterThan(1);
  f.bested = [...ids].sort((a, b) => power(s, actor(s, a)) - power(s, actor(s, b))); // weakest first
  offerAtEnding(s, f, 'resolved', dice(1, 100, 100), []);
  const o = s.player.progression!.essenceOffers!;
  expect(o).toHaveLength(2);
  expect(o[0].pair).toBe(o[1].pair);
  expect(o.map((x) => x.from)).toEqual([actor(s, f.bested[0]).names.current, actor(s, f.bested[f.bested.length - 1]).names.current]);
  expect(passEssence(s, 0)).toBeNull();
  expect(s.player.progression!.essenceOffers).toHaveLength(1); // passing one keeps the other
  offerAtEnding(s, f, 'resolved', dice(1, 100, 100), []);
  expect(takeEssence(s, 1, true)).toBeNull();
  expect(s.player.progression!.essenceOffers?.filter((x) => x.pair === `ending:${s.turn}`) ?? []).toHaveLength(0);
});

it('EB3: the first three essence changes are free; the fourth costs one level of XP', () => {
  const s = makeVillage(), p = s.player, pr = p.progression!;
  const xp = pr.xp;
  for (let n = 0; n < CONFIG.ESSENCE_FREE_CHANGES; n++) {
    pr.essences = [{ essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 2 }, turn: s.turn }];
    expect(removeEssence(s, 0, true)).toBeNull();
  }
  expect(pr.xp).toBe(xp);
  pr.essences = [{ essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 2 }, turn: s.turn }];
  const cost = xpToNext(p);
  expect(removeEssence(s, 0, true)).toBeNull();
  expect(pr.xp).toBe(xp - cost);
});
