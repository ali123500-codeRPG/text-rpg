// 110 Healing (Ali, 07/11/2026, H1–H11): one table of healing sources applied by one rule. Rest heals Healthy and
// Damaged parts but not Crippled ones; a clinic lifts Crippled parts; a bandage works in a fight and is used up.
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
  action: { type: 'use_item', skill: '', target: null, targetPart: null, item, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState, intent: Intent) => { s.turn += 1; return resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };

describe('110 healing', () => {
  it('rest heals HP and working parts but leaves a Crippled part alone; a clinic lifts it', () => {
    const s = makeVillage();
    const c = s.player.core.condition;
    c.hpLostPct = 40;
    c.parts.left_leg = -30; // Crippled
    c.parts.right_leg = 20; // Damaged
    applyHealing(s, s.player, 'rest');
    expect(c.hpLostPct).toBe(40 - CONFIG.REST_HEAL_PCT);
    expect(c.parts.left_leg).toBe(-30);
    expect(c.parts.right_leg).toBe(20 + CONFIG.REST_HEAL_PCT);
    applyHealing(s, s.player, 'clinic');
    expect(c.hpLostPct).toBe(0);
    expect(c.parts.left_leg).toBe(Math.min(100, CONFIG.CLINIC_HEAL_PCT));
  });
  it('a bandage heals its row, is used up, and shows a line', () => {
    const s = makeVillage();
    s.player.core.inventory.push({ id: 'b1', itemId: 'bandage', qty: 1 });
    s.player.core.condition.hpLostPct = 20; // Hurt
    const ev = turn(s, use('bandage'));
    expect(s.player.core.condition.hpLostPct).toBe(20 - getLibrary().healing!.bandage.hpPct);
    expect(s.player.core.inventory.some((i) => i.id === 'b1')).toBe(false);
    expect(mechanicsLines(s, ev)).toContain('Bandage: Hurt → Bruised');
  });
});
