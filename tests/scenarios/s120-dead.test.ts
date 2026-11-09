// 120 Dead: health lost keeps counting past 100% (Incapacitated) up to 150%, which is Dead.
// Dead is never shown in the UI: the shown track stops at Incapacitated, and nothing heals the dead.
import { describe, expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import { healthLevel, isDownLevel, ruleset, SHOWN_LEVELS, shownLevel } from '../../src/ruleset';
import { applyHealing, wouldHeal } from '../../src/engine/heal';
import { isActive } from '../../src/engine/relations';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';

describe('120 dead', () => {
  it('damage past Incapacitated counts up to 150% and then the actor is Dead', () => {
    const s = makeVillage();
    const g = actor(s, 'guard_1');
    g.core.condition.hpLostPct = 100;
    const hit = { attack: null as never, defense: null, defenseType: null, gap: -3, gapShifts: [], outcome: 'full_hit' as const, locationHow: 'aimed' as const,
      multiplier: 1, deciding: { attack: [], defense: [], gap: [] }, attackerId: 'player', targetId: 'guard_1', weaponId: IT.arming_sword, modeId: 'cut' };
    ruleset.applyEffects({ ...hit, location: 'general', damage: 10 }, s);
    expect(g.core.condition.hpLostPct).toBeGreaterThan(100);
    expect(healthLevel(g)).toBe('Incapacitated');
    ruleset.applyEffects({ ...hit, location: 'general', damage: 10000 }, s);
    expect(g.core.condition.hpLostPct).toBe(CONFIG.HP_LOST_MAX);
    expect(healthLevel(g)).toBe('Dead');
    expect(isActive(g)).toBe(false);
    expect(isDownLevel('Dead') && isDownLevel('Incapacitated') && !isDownLevel('Critical')).toBe(true);
  });
  it('the UI never shows Dead, and nothing heals the dead', () => {
    const s = makeVillage();
    expect(SHOWN_LEVELS().map(([l]) => l)).not.toContain('Dead');
    expect(SHOWN_LEVELS()).toHaveLength(8);
    expect(shownLevel('Dead')).toBe('Incapacitated');
    s.player.core.condition.hpLostPct = CONFIG.HP_LOST_MAX;
    expect(wouldHeal(s, s.player, 'clinic')).toBe(false);
    expect(applyHealing(s, s.player, 'clinic')).toBe(false);
    expect(s.player.core.condition.hpLostPct).toBe(CONFIG.HP_LOST_MAX);
  });
  it('the healing table carries the lever: no row heals the dead now; a row with revivesDead would', () => {
    const s = makeVillage();
    const rows = Object.values(getLibrary().healing!);
    expect(rows.every((r) => r.revivesDead === false)).toBe(true);
    s.player.core.condition.hpLostPct = CONFIG.HP_LOST_MAX;
    const clinic = getLibrary().healing!.clinic;
    clinic.revivesDead = true;
    try {
      expect(applyHealing(s, s.player, 'clinic')).toBe(true);
      expect(healthLevel(s.player)).not.toBe('Dead');
    } finally { clinic.revivesDead = false; }
  });
});
