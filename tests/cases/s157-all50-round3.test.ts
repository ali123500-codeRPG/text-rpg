// 157 All-50 round 3 (PT8–PT11): Grit (Resolve's part: Endurance augments Resolve at 0.25, through PerkDef.augments),
// Against the Grain (Parry's part: no heavy-weapon gap shift on the owner's parries), Iron Rim (Block's part: the shield
// pool takes ×0.75). Swordsman unlocks with Medium or Heavy Weapons 40 and Parry 40, and Blade Wall works with either.
// PT9: Strike and Fade leaves attacks from hiding as they were: nobody rolls twice against the owner in a turn.
import { describe, expect, it } from 'vitest';
import { fit, forcedRng, makeVillage, place, beside } from '../harness';
import { effectiveSkill, ruleset } from '../../src/ruleset';
import { augmentsOf } from '../../src/ruleset/gear';
import { unlockClasses } from '../../src/engine/xp';
import { SKILL_PARTS } from '../../src/library/allPerks';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { CL } from '../../src/library/classIds';
import type { Actor, GameState } from '../../src/types';
import { intent, play } from './w4-kit';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const hold = (a: Actor, itemId: string, id = `${a.id}_w`) => {
  for (const i of a.core.inventory) if (i.equippedIn?.some((h) => h.startsWith('grip:'))) delete i.equippedIn;
  a.core.inventory.push({ id, itemId, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  fit(a, itemId);
};
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };

describe('157 All-50 round 3', () => {
  it('Parry, Block and Resolve carry their parts, all built', () => {
    expect(SKILL_PARTS[SK.parry]).toBe(PK.against_the_grain);
    expect(SKILL_PARTS[SK.block]).toBe(PK.iron_rim);
    expect(SKILL_PARTS[SK.resolve]).toBe(PK.grit);
    for (const id of [PK.against_the_grain, PK.iron_rim, PK.grit]) expect(BUILT_PERKS.has(id)).toBe(true);
  });

  it('Grit: a quarter of Endurance augments Resolve, so every morale roll', () => {
    const s = makeVillage();
    skill(s.player, SK.endurance, 40);
    skill(s.player, SK.resolve, 20);
    const before = effectiveSkill(s, s.player, SK.resolve).value;
    expect(augmentsOf(s.player, SK.resolve).some((a) => a.source.includes('Grit'))).toBe(false);
    give(s.player, PK.grit);
    expect(augmentsOf(s.player, SK.resolve)).toContainEqual({ source: 'Endurance (augments, Grit)', value: 40 * CONFIG.GRIT_SHARE });
    expect(effectiveSkill(s, s.player, SK.resolve).value).toBeCloseTo(before + 40 * CONFIG.GRIT_SHARE, 9);
    expect(augmentsOf(s.player, SK.endurance)).toEqual([]); // one way only
  });

  it('Against the Grain: a heavy blow loses its gap shift against the owner\'s parry, not against a block', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    beside(s, 'patron_1');
    hold(s.player, IT.greataxe, 'axe');
    hold(wim, IT.arming_sword);
    wim.core.standingDefense = 'parry';
    const req = { attackerId: 'player', targetId: 'patron_1', weaponId: 'axe', targetPart: null, aimed: false };
    const heavy = () => ruleset.attack(req, s, forcedRng([50, 50, 50])).gapShifts?.some((g) => g.source === 'heavy vs parry');
    expect(heavy()).toBe(true);
    give(wim, PK.against_the_grain);
    expect(heavy()).toBe(false);
  });

  it('Iron Rim: the shield pool takes ×0.75', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    fit(wim, IT.round_shield).core.inventory.push({ id: 'wim_shield', itemId: IT.round_shield, equippedIn: ['grip:left_arm'] });
    wim.core.standingDefense = 'block';
    hold(s.player, IT.greataxe, 'axe');
    const req = { attackerId: 'player', targetId: 'patron_1', weaponId: 'axe', targetPart: null, aimed: false };
    const lost = () => {
      const r = ruleset.attack(req, s, forcedRng([35, 99])); // a Success hit into a Critical block
      expect(r.location).toBe('shield');
      const sh = wim.core.inventory.find((i) => i.id === 'wim_shield')!;
      sh.pools = { shield: 100 };
      ruleset.applyEffects(r, s);
      return 100 - sh.pools!.shield;
    };
    const base = lost();
    expect(base).toBeGreaterThan(0);
    give(wim, PK.iron_rim);
    expect(lost()).toBeCloseTo(base * CONFIG.IRON_RIM_MULT, 9);
  });

  it('Swordsman unlocks with Parry 40 and Medium or Heavy Weapons 40', () => {
    const run = (medium: number, heavy: number) => {
      const s = makeVillage();
      s.player.core.classes = s.player.core.classes.filter((c) => c.classId !== CL.swordsman);
      skill(s.player, SK.parry, 40);
      skill(s.player, SK.melee_medium, medium);
      skill(s.player, SK.melee_heavy, heavy);
      unlockClasses(s);
      return s.player.core.classes.some((c) => c.classId === CL.swordsman);
    };
    expect(run(40, 0)).toBe(true);
    expect(run(0, 40)).toBe(true);
    expect(run(39, 39)).toBe(false);
  });

  it('Blade Wall: a heavy weapon parry is never outnumbered either', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    hold(npc(s, 'patron_1'), IT.dagger);
    hold(s.player, IT.greatsword);
    s.player.core.standingDefense = 'parry';
    const req = { attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_w', targetPart: null, aimed: false, context: { defensesThisTurn: 1 } };
    const crowded = () => ruleset.attack(req, s, forcedRng([50, 50, 50])).defense?.modifiers.some((m) => m.source === 'outnumbered');
    expect(crowded()).toBe(true);
    give(s.player, PK.blade_wall);
    expect(crowded()).toBe(false);
  });

  it('PT9: a shot from hiding keeps the shooter hidden and Strike and Fade adds no second roll for anyone', () => {
    for (const perk of [false, true]) for (let seed = 1; seed <= 10; seed++) {
      const s = makeVillage();
      beside(s, 'patron_1');
      beside(s, 'guard_1');
      hold(s.player, IT.shortbow, 'bow');
      if (perk) give(s.player, PK.strike_and_fade);
      s.player.posture = 'stealthy';
      for (const a of s.actors) if (a.mind) delete a.mind.knowledge.player;
      play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'bow' } }) }, seed * 31);
      expect(s.player.posture).toBe('stealthy');
      const rolls = (id: string) => s.log.filter((l) => l.code === 'stealth_contest' && (l.detail as { observerId: string }).observerId === id).length;
      expect(rolls('patron_1')).toBe(1);
      expect(rolls('guard_1')).toBe(1);
      expect(npc(s, 'patron_1').mind!.knowledge.player?.status).not.toBe('unaware'); // the target at least suspects the shooter's zone
    }
  });
});
