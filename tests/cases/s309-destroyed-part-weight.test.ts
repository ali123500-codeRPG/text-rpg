// 309 CS24: a Destroyed part's role penalty is DESTROYED_PART_WEIGHT (1.2) times the Crippled one, and the same weight
// counts it toward switching a shared role off (no running), so the two rules agree.
import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG, resetConfig } from '../../src/config';
import { roleOff, woundsMods } from '../../src/ruleset';
import { rolePenaltyOf } from '../../src/ruleset/body';
import { RL } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';

const legWounds = (s: ReturnType<typeof makeVillage>) => woundsMods(s, s.player, SK.dodge).find((m) => m.source.toLowerCase().startsWith('move'))?.value ?? 0;

afterEach(() => resetConfig());

describe('309 a Destroyed part weighs 1.2 Crippled ones', () => {
  it('its role penalty is 1.2 times the Crippled one', () => {
    expect(CONFIG.DESTROYED_PART_WEIGHT).toBe(1.2);
    expect(rolePenaltyOf('destroyed')).toBeCloseTo(CONFIG.ROLE_PENALTY.crippled * 1.2);
    const s = makeVillage();
    s.player.core.condition.parts.left_leg = -50; // Crippled: half the shared Move penalty of two legs
    expect(legWounds(s)).toBeCloseTo(CONFIG.ROLE_PENALTY.crippled / 2);
    s.player.core.condition.parts.left_leg = -100; // Destroyed
    expect(legWounds(s)).toBeCloseTo((CONFIG.ROLE_PENALTY.crippled * 1.2) / 2);
  });
  it('no running uses the same weight: one Crippled leg of two still runs, one Destroyed leg does not', () => {
    const s = makeVillage();
    s.player.core.condition.parts.left_leg = -50;
    expect(roleOff(s, s.player, RL.move)).toBe(false);
    s.player.core.condition.parts.left_leg = -100;
    expect(roleOff(s, s.player, RL.move)).toBe(true);
    CONFIG.DESTROYED_PART_WEIGHT = 1.1; // the lever moves both: 1.1 of 2 legs is under 60%
    expect(roleOff(s, s.player, RL.move)).toBe(false);
  });
});
