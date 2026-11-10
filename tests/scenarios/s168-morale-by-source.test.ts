// 168 Morale has its own restore table (composure), apart from healing, so each tunes on its own: rest names a row in each
// table and restores both. Achievements count morale restored by source (flat points), and HP and morale lost (flat points).
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { applyHealing, calm, calmFromPerk, passiveHealing } from '../../src/engine/heal';
import { payFear } from '../../src/engine/morale';
import { getLibrary, actorBody } from '../../src/library';
import { ruleset, totalHp } from '../../src/ruleset';
import { maxMorale, moraleLost, setMoraleLost } from '../../src/ruleset/morale';
import { CP, FR, HL } from '../../src/library/tableIds';
import { ACH } from '../../src/library/achievementIds';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const calmed = (s: GameState, source: string) => s.player.progression?.tally?.[`calmed:morale_source:${source}`] ?? 0;
const has = (s: GameState, key: string) => !!s.player.progression?.achievements?.some((x) => x.key === key && !x.replacedBy);

describe('168 morale restored by source, health and morale lost', () => {
  it('rest restores health from the healing table and morale from the composure table, each counted under its own row', () => {
    const s = makeVillage(), p = s.player;
    expect(getLibrary().healing![HL.rest].composure).toBe(CP.rest);
    p.core.condition.hpLostPct = 30;
    setMoraleLost(p, maxMorale(p));
    applyHealing(s, p, HL.rest);
    expect(maxMorale(p) - moraleLost(p)).toBeCloseTo(maxMorale(p) * CONFIG.REST_MORALE_PCT / 100, 5);
    expect(calmed(s, CP.rest)).toBeCloseTo(maxMorale(p) * CONFIG.REST_MORALE_PCT / 100, 5);
    // tuning the composure row changes rest's morale and nothing about its health
    getLibrary().composure![CP.rest].pct = 10;
    try {
      setMoraleLost(p, maxMorale(p));
      p.core.condition.hpLostPct = 30;
      applyHealing(s, p, HL.rest);
      expect(maxMorale(p) - moraleLost(p)).toBeCloseTo(maxMorale(p) * 0.1, 5);
      expect(p.core.condition.hpLostPct).toBeCloseTo(30 - CONFIG.REST_HEAL_PCT, 5);
    } finally { getLibrary().composure![CP.rest].pct = CONFIG.REST_MORALE_PCT; }
  });
  it('natural composure, danger passed and perks count apart; an NPC counts nothing', () => {
    const s = makeVillage(), p = s.player;
    p.core.skills[Object.values(getLibrary().composure!).find((c) => c.hourly)!.hourly!.skill] = { raw: 50, true: 50 } as never;
    setMoraleLost(p, maxMorale(p));
    passiveHealing(s, 120);
    expect(calmed(s, CP.natural)).toBeGreaterThan(0);
    calm(s, p, CP.danger_passed);
    expect(calmed(s, CP.danger_passed)).toBeGreaterThan(0);
    expect(calmFromPerk(s, p, 10)).toBeCloseTo(maxMorale(p) * 0.1, 5);
    expect(calmed(s, CP.perk)).toBeCloseTo(maxMorale(p) * 0.1, 5);
    expect(calm(s, p, CP.perk)).toBe(0); // the Perks row is a count only, never applied itself
    const npc = s.actors[0], before = { ...s.player.progression?.tally };
    setMoraleLost(npc, maxMorale(npc));
    calm(s, npc, CP.rest);
    expect(s.player.progression?.tally).toEqual(before);
  });
  it('morale restored chains: Sleep On It at 100 points from rest', () => {
    const s = makeVillage(), p = s.player;
    for (let i = 0; i < 4 && !has(s, ACH.calmed_rest_100); i++) { setMoraleLost(p, maxMorale(p)); calm(s, p, CP.rest); }
    expect(has(s, ACH.calmed_rest_100)).toBe(true);
    expect(has(s, ACH.calmed_natural_50)).toBe(false);
  });
  it('HP lost counts in flat HP from a hit; morale lost counts the points a fear cost', () => {
    const s = makeVillage(), p = s.player;
    const part = actorBody(s, p).parts.find((x) => x.impact === 'normal') ?? actorBody(s, p).parts[0];
    ruleset.applyEffects({ outcome: 'full_hit', location: part.id, damage: 5, targetId: p.id } as never, s);
    const lost = p.core.condition.hpLostPct / 100 * totalHp(s, p);
    expect(lost).toBeGreaterThan(0);
    expect(s.player.progression?.tally?.hp_lost).toBeCloseTo(lost, 5);
    payFear(s, forcedRng([1, 1]), p, FR.lost_intimidation, { gap: 2 });
    expect(s.player.progression?.tally?.morale_lost).toBeCloseTo(moraleLost(p), 5);
    expect(s.player.progression?.tally?.morale_lost).toBeGreaterThan(0);
  });
});
