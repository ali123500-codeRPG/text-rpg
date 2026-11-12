// 207 Essences (growth proposal section 2: EG1 a, EG2, EG3 b, EG4 a, EG9 a, EG12 a, EG15 b): a notable foe beaten, or a scenario
// resolved at Great Success or better, may offer an essence (true skill) the player takes into a limited number of slots.
import { describe, expect, it } from 'vitest';
import type { GameState, Rng } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { ES } from '../../src/library/essenceIds';
import { ACH } from '../../src/library/achievementIds';
import { trueSkill } from '../../src/ruleset/perks';
import { essenceSlots, expireOffers, offerAtEnding, offerRoll, offersFromDefeats, passEssence, removeEssence, takeEssence } from '../../src/engine/essence';
import { frameOf } from '../../src/engine/scenarioEnd';
import { xpToNext } from '../../src/engine/xp';

/** a die that shows the listed d100s in turn (then the last), and picks the first row */
const dice = (...d: number[]): Rng => { let i = 0; return { state: 1, next: () => 0, int: (lo) => lo, d100: () => d[Math.min(i++, d.length - 1)] }; };
const level = (s: GameState, n: number) => { s.player.core.classes[0].level = n; };
const slime = (s: GameState) => s.actors.find((a) => a.id === 'slime_1')!;
const offers = (s: GameState) => s.player.progression!.essenceOffers ?? [];

describe('207 essences', () => {
  it('EG2: one slot, then one more every 7 character levels', () => {
    const s = makeVillage();
    expect(essenceSlots(s.player)).toBe(1);
    level(s, 7);
    expect(essenceSlots(s.player)).toBe(2);
    level(s, 14);
    expect(essenceSlots(s.player)).toBe(3);
  });

  it('the offer roll: d100 + base − 150 on the tier table, natural edges included', () => {
    expect(offerRoll(dice(69), 80)).toBeNull(); // Near Miss
    expect(offerRoll(dice(70), 80)).toEqual({ grade: 'common', past: 0 });
    expect(offerRoll(dice(95), 80)).toEqual({ grade: 'fine', past: 0 });
    expect(offerRoll(dice(96), 80)).toEqual({ grade: 'rare', past: 0 }); // a natural high lifts Great to Critical
  });

  it('a notable foe beaten offers once, ever, an essence of its race; points come from its skills', () => {
    const s = makeVillage(), foe = slime(s);
    foe.core.skills[SK.endurance] = { raw: 60, state: 'normal' };
    foe.core.skills[SK.tremor] = { raw: 30, state: 'normal' };
    foe.core.generation = 'unique'; // notable whatever its power
    offersFromDefeats(s, [foe], dice(100));
    expect(offers(s)).toHaveLength(1);
    const o = offers(s)[0];
    expect(o).toMatchObject({ essence: ES.gel_patience, grade: 'rare', source: 'foe', until: s.turn + CONFIG.ESSENCE_OFFER_TURNS });
    // source skill = (60 × 2 + 30 × tremor tier × 1) ÷ 3, × 0.07 × 2.5, split 2 : 1
    const total = Object.values(o.points).reduce((n, v) => n + v, 0);
    expect(total).toBeGreaterThan(0);
    expect(o.points[SK.endurance]).toBeGreaterThanOrEqual(o.points[SK.tremor] ?? 0);
    offersFromDefeats(s, [foe], dice(100));
    expect(offers(s)).toHaveLength(1);
  });

  it('taking fills a slot and adds true skill (EG4 a); First Knot is earned; a full slot needs one given up, at rest, for one level of XP', () => {
    const s = makeVillage(), p = s.player, pr = p.progression!;
    const before = trueSkill(p, SK.dodge);
    pr.essenceOffers = [
      { essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 3 }, turn: s.turn, source: 'foe', until: s.turn + 5 },
      { essence: ES.gate_habit, grade: 'fine', points: { [SK.block]: 4 }, turn: s.turn, source: 'foe', until: s.turn + 5 },
    ];
    expect(takeEssence(s, 0, true)).toBeNull();
    expect(trueSkill(p, SK.dodge)).toBe(before + 3);
    expect((pr.achievements ?? []).some((a) => a.key === ACH.first_knot)).toBe(true);
    expect(takeEssence(s, 0, true)).toMatch(/no room/);
    expect(takeEssence(s, 0, false, 0)).toMatch(/at rest/);
    const xp = pr.xp, cost = xpToNext(p);
    expect(takeEssence(s, 0, true, 0)).toBeNull();
    expect(pr.essences!.map((e) => e.essence)).toEqual([ES.gate_habit]);
    expect(trueSkill(p, SK.dodge)).toBe(before);
    expect(pr.xp).toBe(xp - cost); // EG15 b: into debt if need be
    expect(removeEssence(s, 0, true)).toBeNull();
    expect(pr.essences).toBeUndefined();
  });

  it('a resolved ending at Great Success offers from the foes beaten, or a deed essence on the most-marked skill', () => {
    const s = makeVillage();
    const f = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'great_success', (_k, r) => r);
    offerAtEnding(s, f, 'lost', dice(100), [[SK.dodge, 2]]);
    expect(offers(s)).toHaveLength(0); // only resolved endings offer
    offerAtEnding(s, f, 'resolved', dice(100), [[SK.block, 1], [SK.dodge, 3]]);
    expect(offers(s)[0]).toMatchObject({ essence: ES.hard_won_habit, source: 'ending' });
    expect(Object.keys(offers(s)[0].points)).toEqual([SK.dodge]);
    f.beaten = ['slime_1'];
    offerAtEnding(s, f, 'resolved', dice(100), []);
    expect(offers(s)[1].essence).toBe(ES.gel_patience);
    const success = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r);
    offerAtEnding(s, success, 'resolved', dice(100), [[SK.dodge, 1]]);
    expect(offers(s)).toHaveLength(2); // Success endings don't offer
  });

  it('offers lapse after their last turn, or when a new scenario starts; passing drops one', () => {
    const s = makeVillage(), pr = s.player.progression!;
    pr.essenceOffers = [
      { essence: ES.gate_habit, grade: 'common', points: { [SK.block]: 2 }, turn: s.turn - 1, source: 'foe', until: s.turn + 3 },
      { essence: ES.gate_habit, grade: 'common', points: { [SK.block]: 2 }, turn: s.turn, source: 'foe', until: s.turn + 3 },
      { essence: ES.gate_habit, grade: 'common', points: { [SK.block]: 2 }, turn: s.turn - 9, source: 'foe', until: s.turn - 1 },
    ];
    expireOffers(s);
    expect(pr.essenceOffers).toHaveLength(2);
    expireOffers(s, true);
    expect(pr.essenceOffers).toHaveLength(1);
    expect(passEssence(s, 0)).toBeNull();
    expect(pr.essenceOffers).toBeUndefined();
  });
});
