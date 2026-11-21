// 110 Healing (H1–H11): one table of healing sources applied by one rule. Rest heals Healthy and
// Damaged parts but not Crippled ones; a clinic lifts Crippled parts; a bandage works in a fight and is used up.
import { HL } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { applyHealing } from '../../src/engine/heal';
import { mechanicsLines } from '../../src/agents/game';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import type { GameState, Intent } from '../../src/types';

const use = (item: string): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type: 'use_item', skill: '', target: null, targetPart: null, item, mode: null, approach: '' },
});
const turn = (s: GameState, intent: Intent) => { s.turn += 1; return resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };

describe('110 healing', () => {
  it('D-114: a heal mends every wound it reaches by the same share; a Crippled part is left out until a clinic', () => {
    const s = makeVillage();
    const c = s.player.core.condition;
    // humanoid legs are normal parts (PART_SHARE 0.3 of HP): Crippled left leg 39% of HP, right leg 9%, torso (general) 20%
    c.parts.left_leg = -30;
    c.parts.right_leg = 70;
    c.hpLostPct = 68;
    applyHealing(s, s.player, HL.rest);
    const share = CONFIG.REST_HEAL_PCT / (20 + 9); // HD3: the Crippled leg is out of the share
    expect(c.hpLostPct).toBeCloseTo(68 - CONFIG.REST_HEAL_PCT, 6);
    expect(c.parts.left_leg).toBe(-30);
    expect(c.parts.right_leg).toBeCloseTo(70 + share * 30, 6);
    applyHealing(s, s.player, HL.clinic);
    expect(c.hpLostPct).toBe(0);
    expect(c.parts.left_leg).toBeCloseTo(100, 6);
    // HD4: no jump to 0 first: the Crippled leg mends the share of its whole wound
    c.hpLostPct = 140; c.parts.left_leg = -60; c.parts.right_leg = -60; // 48% each, torso 44%
    applyHealing(s, s.player, HL.clinic);
    expect(c.parts.left_leg).toBeCloseTo(-60 + (CONFIG.CLINIC_HEAL_PCT / 140) * 160, 6);
    // HD5: a part still hurt with health full mends from the row's amount
    c.hpLostPct = 0; c.parts.left_leg = 90; c.parts.right_leg = 100;
    applyHealing(s, s.player, HL.rest);
    expect(c.parts.left_leg).toBe(100);
  });
  it('a healing item is not used up when there is nothing to heal (Q3); hurt, a bandage heals its row, is used up, and shows a line', () => {
    const s = makeVillage();
    s.player.core.inventory.push({ id: 'b1', itemId: IT.bandage, qty: 1 });
    s.player.core.condition.hpLostPct = 0;
    const kept = turn(s, use(IT.bandage));
    expect(s.player.core.inventory.some((i) => i.id === 'b1')).toBe(true);
    expect(mechanicsLines(s, kept)).toContain('Bandage: nothing to heal, so you keep it');
    s.player.core.condition.hpLostPct = 20; // Hurt
    s.player.core.skills[SK.first_aid] = { raw: 50, state: 'normal' }; // D-235 a: First Aid 50 heals the whole row
    const ev = turn(s, use(IT.bandage));
    expect(s.player.core.condition.hpLostPct).toBeCloseTo(20 - getLibrary().healing![HL.bandage].hpPct, 0);
    expect(s.player.core.inventory.some((i) => i.id === 'b1')).toBe(false);
    expect(mechanicsLines(s, ev)).toContain('Bandage: Hurt → Bruised');
  });
  it('D-235b b: a use marks First Aid as a passed check at the row\'s grade: a bandage (minor) teaches up to raw 45, not past it', () => {
    for (const [raw, marked] of [[40, true], [50, false]] as const) {
      const s = makeVillage();
      s.player.core.inventory.push({ id: 'b1', itemId: IT.bandage, qty: 1 });
      s.player.core.skills[SK.first_aid] = { raw, state: 'normal' };
      s.player.core.condition.hpLostPct = 40;
      turn(s, use(IT.bandage));
      expect(s.player.progression!.marks.includes(SK.first_aid)).toBe(marked);
    }
  });
  it('D-235 a: the user\'s First Aid scales what a healing item heals: half the row at 0, one and a half at 100', () => {
    const row = () => getLibrary().healing![HL.bandage].hpPct;
    for (const [raw, mult] of [[0, 0.5], [100, 1.5]]) {
      const s = makeVillage();
      s.player.core.inventory.push({ id: 'b1', itemId: IT.bandage, qty: 1 });
      s.player.core.skills[SK.first_aid] = { raw, state: 'normal' };
      s.player.core.condition.hpLostPct = 40;
      turn(s, use(IT.bandage));
      expect(s.player.core.condition.hpLostPct).toBeCloseTo(40 - row() * mult, 1); // the turn's few seconds of natural recovery heal a hair more
    }
  });
});
