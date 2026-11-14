// 283 D-276 (Barbarian novel study, round 8, AK1 to AK4): two more kinds of augment on the one augment entry.
// Trade: the receiving skill gains the giving skill's true skill × share (CONFIG.AUGMENT_TRADE_SHARE) × its tier, and the
// giving skill's own rolls lose the same, always (points moved, never made). Percentage: the receiving skill gains the giving
// true skill ÷ 100 × rate (CONFIG.AUGMENT_PERCENT_RATE) × its own true skill; two on one skill add in full (RN3 c), and a
// plain augment never halves a percentage one. First use of trade: the Tavern Brawler essence's trait, Fists Do the Talking.
import { expect, it } from 'vitest';
import type { Actor, GameState, PerkDef } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { ES } from '../../src/library/essenceIds';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { getLibrary } from '../../src/library';
import { takeEssence } from '../../src/engine/essence';
import { hasPerk, trueSkill } from '../../src/ruleset/perks';
import { augmentFactors, augmentsOf, effectiveSkill, tierMult, tradesOut } from '../../src/ruleset/gear';
import { essenceStats } from '../../src/ui/essences';
import { now } from '../../src/time';

const set = (a: Actor, skill: string, raw: number) => { a.core.skills[skill] = { raw, state: 'normal' }; };
const eff = (s: GameState, skill: string) => effectiveSkill(s, s.player, skill).value;
const own = (s: GameState, perkId: string) => s.player.core.perks.push({ perkId, source: 'essence', gainedTurn: s.turn });
/** run `body` with library perk rows changed, then put them back (makeVillage reloads the library, so call it first) */
function withPerks(rows: Record<string, Partial<PerkDef>>, body: () => void) {
  const perks = getLibrary().perks, before = Object.fromEntries(Object.keys(rows).map((k) => [k, perks[k]]));
  try { for (const [k, r] of Object.entries(rows)) perks[k] = { ...perks[k], ...r } as PerkDef; body(); } finally { Object.assign(perks, before); }
}

it('trade: Fists Do the Talking moves half of true Strike into Intimidation; Strike rolls lose the same', () => {
  const s = makeVillage(), p = s.player;
  set(p, SK.unarmed_strike, 50);
  set(p, SK.intimidation, 20);
  const strike = eff(s, SK.unarmed_strike), threat = eff(s, SK.intimidation);
  own(s, PK.fists_do_the_talking);
  const moved = trueSkill(p, SK.unarmed_strike) * CONFIG.AUGMENT_TRADE_SHARE * tierMult(SK.unarmed_strike);
  expect(moved).toBeGreaterThan(0);
  expect(eff(s, SK.intimidation) - threat).toBeCloseTo(moved);
  expect(strike - eff(s, SK.unarmed_strike)).toBeCloseTo(moved);
  expect(trueSkill(p, SK.unarmed_strike)).toBe(50); // true skill is untouched: only rolls move
  expect(augmentsOf(p, SK.intimidation).map((a) => a.source)).toEqual(['Strike (trades in, Fists Do the Talking)']);
  expect(tradesOut(p, SK.unarmed_strike)[0].source).toBe('traded to Intimidation (Fists Do the Talking)');
  expect(augmentFactors(p, SK.intimidation).map((a) => a.id)).toEqual([SK.unarmed_strike]); // Strike learns from the threats
});

it('trade: a dormant trait gives nothing and takes nothing', () => {
  const s = makeVillage(), p = s.player;
  set(p, SK.unarmed_strike, 50);
  const strike = eff(s, SK.unarmed_strike);
  p.core.perks.push({ perkId: PK.fists_do_the_talking, source: 'essence', gainedTurn: s.turn, dormant: true });
  expect(eff(s, SK.unarmed_strike)).toBeCloseTo(strike);
  expect(augmentsOf(p, SK.intimidation)).toEqual([]);
});

it('first use: taking a Tavern Brawler essence brings its trait, and the offer shows it', () => {
  const s = makeVillage(), p = s.player;
  expect(getLibrary().essences![ES.tavern_brawler].trait).toBe(PK.fists_do_the_talking);
  set(p, SK.unarmed_strike, 40);
  const offer = { essence: ES.tavern_brawler, grade: 'common' as const, points: { [SK.unarmed_strike]: 2 }, turn: s.turn, source: 'foe' as const, untilMin: now(s) + 5 };
  expect(essenceStats(offer)).toEqual(['+2 Strike', 'Trait: Fists Do the Talking']);
  p.progression!.essenceOffers = [offer];
  expect(takeEssence(s, 0, true)).toBeNull();
  expect(hasPerk(p, PK.fists_do_the_talking)).toBe(true);
  expect(tradesOut(p, SK.unarmed_strike)[0].value).toBeCloseTo(-trueSkill(p, SK.unarmed_strike) * CONFIG.AUGMENT_TRADE_SHARE * tierMult(SK.unarmed_strike));
});

it('percentage: giving true skill ÷ 100 × rate × the receiving true skill; both at 50 adds 5, at 100 adds 20', () => {
  const s = makeVillage(), p = s.player;
  withPerks({ [PK.fists_do_the_talking]: { augments: [{ from: SK.endurance, skill: SK.resolve, kind: 'percent' }] } }, () => {
    own(s, PK.fists_do_the_talking);
    for (const [v, add] of [[50, 5], [100, 20]]) {
      set(p, SK.endurance, v);
      set(p, SK.resolve, v);
      const got = augmentsOf(p, SK.resolve).find((a) => a.source.startsWith('Endurance (augments by share'))!;
      expect(got.value).toBeCloseTo(add * tierMult(SK.endurance)); // CONFIG.AUGMENT_PERCENT_RATE 0.2
      expect(tradesOut(p, SK.endurance)).toEqual([]); // nothing is taken from the giver
    }
  });
});

it('percentage: two on one skill both add in full (RN3 c); a plain one adds in full beside them', () => {
  const s = makeVillage(), p = s.player;
  withPerks({
    [PK.fists_do_the_talking]: { augments: [{ from: SK.endurance, skill: SK.resolve, kind: 'percent' }, { from: SK.dodge, skill: SK.resolve, kind: 'percent' }] },
    [PK.dreaded_on_sight]: { augments: [{ from: SK.block, skill: SK.resolve, share: 0.25 }] },
  }, () => {
    own(s, PK.fists_do_the_talking);
    own(s, PK.dreaded_on_sight);
    set(p, SK.resolve, 100);
    set(p, SK.endurance, 100);
    set(p, SK.dodge, 50);
    set(p, SK.block, 40);
    const by = (name: string) => augmentsOf(p, SK.resolve).find((a) => a.source.startsWith(name))!.value;
    expect(by('Endurance')).toBeCloseTo(100 / 100 * CONFIG.AUGMENT_PERCENT_RATE * 100 * tierMult(SK.endurance));
    expect(by('Dodge')).toBeCloseTo(50 / 100 * CONFIG.AUGMENT_PERCENT_RATE * 100 * tierMult(SK.dodge));
    expect(by('Block')).toBeCloseTo(40 * 0.25 * tierMult(SK.block)); // plain: never halved by the percentage ones
  });
});
