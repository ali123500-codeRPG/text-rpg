// 155 Healing by source: achievements count the health % the player gets back, kept apart by where it came from
// (a healing-table row). Rest, natural recovery and perks (Second Wind, Fast Healer's extra) each have their own count.
import { HL } from '../../src/library/tableIds';
import { PK } from '../../src/library/perkIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { applyHealing, passiveHealing } from '../../src/engine/heal';
import { achievementName } from '../../src/engine';
import { tally } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const healed = (s: GameState, source: string) => s.player.progression?.tally?.[`healed:heal_source:${source}`] ?? 0;

describe('155 healing by source', () => {
  it('rest counts what it actually healed, under the rest row only', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 10;
    applyHealing(s, s.player, HL.rest);
    expect(healed(s, HL.rest)).toBeCloseTo(Math.min(10, CONFIG.REST_HEAL_PCT), 5); // capped by what was lost
    expect(healed(s, HL.passive)).toBe(0);
    applyHealing(s, s.player, HL.rest); // nothing left to heal: nothing counted
    expect(healed(s, HL.rest)).toBeCloseTo(Math.min(10, CONFIG.REST_HEAL_PCT), 5);
  });
  it('natural recovery counts under its own row; Fast Healer\'s extra counts as healing from perks', () => {
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
    expect(healed(fast, HL.passive) + healed(fast, HL.perk)).toBeCloseTo(total, 5);
    expect(healed(fast, HL.perk)).toBeCloseTo(healed(fast, HL.passive), 5); // ×2: half is the perk's
  });
  it('a clinic and a bandage keep their own counts; healing an NPC counts nothing', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 30;
    applyHealing(s, s.player, HL.bandage);
    applyHealing(s, s.player, HL.clinic);
    expect(healed(s, HL.bandage)).toBeCloseTo(getLibrary().healing![HL.bandage].hpPct, 5);
    expect(healed(s, HL.clinic)).toBeCloseTo(30 - getLibrary().healing![HL.bandage].hpPct, 5);
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
});
