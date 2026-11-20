// 330 NPC roles, second round (NR8, NR13, NR33 to NR35): the Leader and Knight roles, the Knight class (tier 2, placeholder
// unlock), the Healing skill in its own Medicine tree, and Heal, open at true Healing 50, as an action on oneself or on
// someone within arm's reach.
import { describe, expect, it } from 'vitest';
import type { GameState, Intent } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { healShare } from '../../src/ruleset/body';
import { unlockClasses } from '../../src/engine/xp';
import { classMaxLevel } from '../../src/library/spawn';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { CONFIG } from '../../src/config';
import { TIERS } from '../../src/scales';

const heal = (target: string | null): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type: 'heal', skill: '', target, item: null, targetPart: null, mode: null, approach: '' },
});
const turn = (s: GameState, i: Intent, seed = 1) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };

describe('330 NPC roles, second round', () => {

  it('NR36: Knight Trainee opens at Heavy Armor and a melee weapon 40; at its top level it opens Knight', () => {
    const s = makeVillage(), p = s.player;
    const has = (id: string) => p.core.classes.some((c) => c.classId === id);
    p.core.skills[SK.heavy_armor] = { raw: 40, state: 'normal' }; p.core.skills[SK.melee_medium] = { raw: 40, state: 'normal' };
    unlockClasses(s);
    expect(has(CL.knight_trainee)).toBe(true);
    expect(has(CL.knight)).toBe(false);
    p.core.classes.find((c) => c.classId === CL.knight_trainee)!.level = classMaxLevel(CL.knight_trainee) - 1;
    unlockClasses(s);
    expect(has(CL.knight)).toBe(false);
    p.core.classes.find((c) => c.classId === CL.knight_trainee)!.level = classMaxLevel(CL.knight_trainee);
    unlockClasses(s);
    expect(has(CL.knight)).toBe(true);
  });

  it('NR34: the share of what is missing grows by tier, and past Critical Success by a step each', () => {
    expect(healShare(TIERS.pos('failure'))).toBe(0);
    expect(healShare(TIERS.pos('near_miss'))).toBe(0.05);
    expect(healShare(TIERS.pos('success'))).toBe(0.1);
    expect(healShare(TIERS.pos('great_success'))).toBe(0.15);
    expect(healShare(TIERS.pos('critical_success'))).toBe(0.25);
    expect(healShare(TIERS.pos('critical_success') + 2)).toBeCloseTo(0.25 + 2 * CONFIG.HEAL_PAST_STEP);
  });

  it('NR34: below Healing 50 Heal comes to nothing; at 150 it mends the healer', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 40;
    s.player.core.skills[SK.healing] = { raw: 30, state: 'normal' };
    turn(s, heal(null));
    expect(s.player.core.condition.hpLostPct).toBeGreaterThan(39.9); // only natural recovery
    expect(s.events.some((e) => e.kind === 'wasted' && e.reason === 'no_power')).toBe(true);
    s.player.core.skills[SK.healing] = { raw: 150, state: 'normal' };
    turn(s, heal(null), 3);
    const ev = s.events.filter((e) => e.kind === 'heal').at(-1)!;
    expect(ev).toBeDefined();
    expect(s.player.core.condition.hpLostPct).toBeLessThan(39);
    expect(ev.effects.some((f) => f.kind === 'healed')).toBe(true);
  });
});
