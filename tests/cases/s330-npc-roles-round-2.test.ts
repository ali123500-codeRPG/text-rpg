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
import { getLibrary } from '../../src/library';
import { RO } from '../../src/library/npcLayerIds';
import { SK } from '../../src/library/skillIds';
import { TR } from '../../src/library/treeIds';
import { CL } from '../../src/library/classIds';
import { FN, GR } from '../../src/library/functionIds';
import { FUNCTION_GROUP } from '../../src/library/functionNames';
import { CONFIG } from '../../src/config';
import { TIERS } from '../../src/scales';

const heal = (target: string | null): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type: 'heal', skill: '', target, item: null, targetPart: null, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState, i: Intent, seed = 1) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };

describe('330 NPC roles, second round', () => {
  it('NR8, NR13: a civilian Leader and a combat Knight in heavy armour', () => {
    const r = getLibrary().npcRoles!;
    expect(r[RO.leader].kind).toBe('civilian');
    expect(r[RO.leader].bands.high).toEqual([SK.persuasion, SK.intimidation, SK.command]);
    expect(r[RO.knight].kind).toBe('combat');
    expect(r[RO.knight].bands.high).toEqual([SK.melee_medium, SK.heavy_armor]);
  });

  it('NR13, NR36: Knight is tier 2: the Arms All-50, one weapon at 100 and Heavy Armor 75, or Knight Trainee at its top level', () => {
    const k = getLibrary().classes[CL.knight];
    expect(k.tier).toBe('tier_2');
    expect(k.unlock).toEqual({ [SK.melee_light]: 50, [SK.melee_medium]: 50, [SK.melee_heavy]: 50, [SK.heavy_armor]: 75 });
    expect(k.unlockAny).toEqual([{ [SK.melee_light]: 100, [SK.melee_medium]: 100, [SK.melee_heavy]: 100 }]);
    expect(k.orUnlocks).toEqual([{ unlockClass: { [CL.knight_trainee]: 'max' } }]);
    expect(getLibrary().classes[CL.knight_trainee].tier).toBe('tier_1');
  });

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

  it('NR33: Healing sits alone in the Medicine tree, closed to bodies with no hands, in its own Medicine group', () => {
    const t = getLibrary().trees[TR.medicine];
    expect(t.skills).toEqual([SK.healing]);
    expect(t.access?.blockedBy?.length).toBe(1);
    expect(getLibrary().skills[SK.healing].functions).toEqual([FN.healing]);
    expect(FUNCTION_GROUP[FN.healing]).toBe(GR.medicine);
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
