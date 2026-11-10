// 155 Healing by source: achievements count the HP the player gets back (a flat number), kept apart by where it came
// from (a healing-table row). Rest, natural recovery and perks (Second Wind; Fast Healer counts as natural recovery) each have their own
// count and their own achievement chain (D-172, D-173).
import { HL } from '../../src/library/tableIds';
import { PK } from '../../src/library/perkIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { applyHealing, passiveHealing } from '../../src/engine/heal';
import { achievementName } from '../../src/engine';
import { tally } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { totalHp } from '../../src/ruleset';
import { ACH } from '../../src/library/achievementIds';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const healed = (s: GameState, source: string) => s.player.progression?.tally?.[`healed:heal_source:${source}`] ?? 0;
const hp = (s: GameState, pct: number) => pct / 100 * totalHp(s, s.player);
const has = (s: GameState, key: string) => !!s.player.progression?.achievements?.some((x) => x.key === key && !x.replacedBy);

describe('155 healing by source', () => {
  it('rest counts what it actually healed, under the rest row only', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 10;
    applyHealing(s, s.player, HL.rest);
    expect(healed(s, HL.rest)).toBeCloseTo(hp(s, Math.min(10, CONFIG.REST_HEAL_PCT)), 5); // HP, capped by what was lost
    expect(healed(s, HL.passive)).toBe(0);
    applyHealing(s, s.player, HL.rest); // nothing left to heal: nothing counted
    expect(healed(s, HL.rest)).toBeCloseTo(hp(s, Math.min(10, CONFIG.REST_HEAL_PCT)), 5);
  });
  it('natural recovery counts under its own row, Fast Healer\'s doubled amount included: it is not perk healing', () => {
    const plain = makeVillage();
    plain.player.core.condition.hpLostPct = 30;
    passiveHealing(plain, 120);
    const base = healed(plain, HL.passive);
    expect(base).toBeGreaterThan(0);
    expect(healed(plain, HL.perk)).toBe(0);
    const fast = makeVillage();
    fast.player.core.condition.hpLostPct = 30;
    give(fast.player, PK.quick_mend);
    passiveHealing(fast, 120);
    const total = 30 - fast.player.core.condition.hpLostPct;
    expect(healed(fast, HL.passive)).toBeCloseTo(hp(fast, total), 5);
    expect(healed(fast, HL.passive)).toBeGreaterThan(base * 2 - 1e-9); // ×2 (its +5 true skill adds a little more)
    expect(healed(fast, HL.perk)).toBe(0); // only perks that heal directly count as perk healing
  });
  it('a clinic and a bandage keep their own counts; healing an NPC counts nothing', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 30;
    applyHealing(s, s.player, HL.bandage);
    applyHealing(s, s.player, HL.clinic);
    expect(healed(s, HL.bandage)).toBeCloseTo(hp(s, getLibrary().healing![HL.bandage].hpPct), 5);
    expect(healed(s, HL.clinic)).toBeCloseTo(hp(s, 30 - getLibrary().healing![HL.bandage].hpPct), 5);
    expect(healed(s, HL.rest)).toBe(0);
    const npc = s.actors[0];
    npc.core.condition.hpLostPct = 30;
    const before = { ...s.player.progression?.tally };
    applyHealing(s, npc, HL.rest);
    expect(s.player.progression?.tally).toEqual(before);
  });
  it('the Perks row is only a counting source: it heals nothing itself', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 30;
    expect(getLibrary().healing![HL.perk].countOnly).toBe(true);
    expect(applyHealing(s, s.player, HL.perk)).toBe(false);
    expect(s.player.core.condition.hpLostPct).toBe(30);
  });
  it('an achievement can count healing from one source and name it', () => {
    const s = makeVillage();
    const lib = getLibrary().achievements!;
    lib.TEST_HEAL = { id: 'TEST_HEAL', name: 'Mended by {source}', level: 'i', rule: 'healed', by: 'heal_source', tags: ['survival'], count: 100 };
    try {
      tally(s, 'healed', { by: 'heal_source', of: HL.passive, add: 60 });
      tally(s, 'healed', { by: 'heal_source', of: HL.rest, add: 60 });
      expect(!!s.player.progression?.achievements?.some((x) => x.key === 'TEST_HEAL')).toBe(false); // sources don't add up
      tally(s, 'healed', { by: 'heal_source', of: HL.passive, add: 40 });
      const got = s.player.progression?.achievements?.find((x) => x.key === 'TEST_HEAL');
      expect(got?.of).toBe(HL.passive);
      expect(achievementName(s, got!)).toBe('Mended by Natural Recovery');
    } finally { delete lib.TEST_HEAL; }
  });
  it('each source has its own chain, counted in HP: rest heals never earn the natural-recovery or perk lines', () => {
    const s = makeVillage();
    tally(s, 'healed', { by: 'heal_source', of: HL.rest, add: 99 });
    expect(has(s, ACH.healed_rest_100)).toBe(false);
    tally(s, 'healed', { by: 'heal_source', of: HL.rest, add: 1 });
    expect(has(s, ACH.healed_rest_100)).toBe(true);
    expect(has(s, ACH.healed_natural_50) || has(s, ACH.healed_perk_50)).toBe(false);
    tally(s, 'healed', { by: 'heal_source', of: HL.rest, add: 900 });
    expect(has(s, ACH.healed_rest_1000)).toBe(true);
    expect(has(s, ACH.healed_rest_100)).toBe(false); // replaced by the higher level
    tally(s, 'healed', { by: 'heal_source', of: HL.clinic, add: 5000 }); // a clinic is not resting
    expect(has(s, ACH.healed_rest_10000)).toBe(false);
    tally(s, 'healed', { by: 'heal_source', of: HL.passive, add: 50 });
    expect(has(s, ACH.healed_natural_50)).toBe(true);
    expect(achievementName(s, s.player.progression!.achievements!.find((x) => x.key === ACH.healed_natural_50)!)).toBe('Knits Back Together');
    tally(s, 'healed', { by: 'heal_source', of: HL.perk, add: 2500 });
    expect(has(s, ACH.healed_perk_2500)).toBe(true);
  });
});
