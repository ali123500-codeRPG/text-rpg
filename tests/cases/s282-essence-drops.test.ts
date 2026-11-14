// 282 D-274 and FP8 (Barbarian novel study): every beaten foe can leave an essence. A notable foe's always appears and any
// other foe's (a mob's) at ESSENCE_APPEAR_CHANCE.mob, so for a notable foe the quality roll alone decides whether it fades.
// A held essence's trait or quirk is a perk its holder owns once, however many held essences carry it; its points still add.
import { expect, it } from 'vitest';
import type { GameState, Rng } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { ES } from '../../src/library/essenceIds';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { getLibrary } from '../../src/library';
import { notable, offersFromDefeats, removeEssence, takeEssence } from '../../src/engine/essence';
import { hasPerk, trueSkill } from '../../src/ruleset/perks';
import { now } from '../../src/time';

const dice = (...d: number[]): Rng => { let i = 0; return { state: 1, next: () => 0, int: (lo) => lo, d100: () => d[Math.min(i++, d.length - 1)] }; };
const slime = (s: GameState) => s.actors.find((a) => a.id === 'slime_1')!;
// BG-199: an essence comes only from a death, from a foe the player hurt
const slain = <T extends { core: { condition: { hpLostPct: number } }; mind?: { hitByPlayer?: boolean } }>(a: T): T => { a.core.condition.hpLostPct = 200; a.mind!.hitByPlayer = true; return a; };
const codes = (s: GameState) => s.log.filter((l) => l.code.startsWith('essence_')).map((l) => l.code);

it('D-274: a notable foe always leaves an essence; only its quality roll can make it fade', () => {
  expect(CONFIG.ESSENCE_APPEAR_CHANCE.foe).toBe(100);
  for (const q of [100, 1]) {
    const s = makeVillage(), foe = slime(s);
    foe.core.generation = 'rolled'; // notable
    offersFromDefeats(s, [slain(foe)], dice(100, q)); // the worst appearance die still appears
    expect(codes(s)).toEqual(q === 100 ? ['essence_appeared', 'essence_offered'] : ['essence_appeared', 'essence_faded']);
  }
});

it('D-274: a mob leaves one at ESSENCE_APPEAR_CHANCE.mob', () => {
  const hit = makeVillage(), miss = makeVillage();
  expect(notable(hit, slime(hit))).toBe(false);
  offersFromDefeats(hit, [slain(slime(hit))], dice(CONFIG.ESSENCE_APPEAR_CHANCE.mob, 100));
  offersFromDefeats(miss, [slain(slime(miss))], dice(CONFIG.ESSENCE_APPEAR_CHANCE.mob + 1, 100));
  expect(codes(hit)[0]).toBe('essence_appeared');
  expect(codes(miss)).toEqual([]);
});

it('FP8: the same trait held twice counts once; its points add; it goes only with the last essence that carries it', () => {
  const s = makeVillage(), p = s.player, pr = p.progression!;
  const row = getLibrary().essences![ES.street_instinct];
  const had = row.trait;
  row.trait = PK.dirt_in_the_eyes;
  try {
    p.core.classes[0].level = 7; // two slots
    const base = trueSkill(p, SK.dodge);
    pr.essenceOffers = [0, 1].map(() => ({ essence: ES.street_instinct, grade: 'common' as const, points: { [SK.dodge]: 3 }, turn: s.turn, source: 'foe' as const, untilMin: now(s) + 5 }));
    expect(takeEssence(s, 0, true)).toBeNull();
    expect(takeEssence(s, 0, true)).toBeNull();
    expect(p.core.perks.filter((x) => x.perkId === PK.dirt_in_the_eyes)).toHaveLength(1);
    expect(trueSkill(p, SK.dodge)).toBe(base + 6);
    expect(removeEssence(s, 0, true)).toBeNull();
    expect(hasPerk(p, PK.dirt_in_the_eyes)).toBe(true);
    expect(removeEssence(s, 0, true)).toBeNull();
    expect(hasPerk(p, PK.dirt_in_the_eyes)).toBe(false);
  } finally {
    if (had === undefined) delete row.trait; else row.trait = had;
  }
});
