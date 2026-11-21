// 118 40/80/120 perks ("40 milestone perks: options"): +5 true skill in the skill, +1 in every other skill
// sharing a function, plus one number. Darkness never helps a sneaker against a listener (P14).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forcedRng, makeVillage, place, fit } from '../harness';
import { ruleset, trueSkill } from '../../src/ruleset';
import { passiveHealing } from '../../src/engine/heal';
import type { Actor, GameState, RollRequest } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { AM } from '../../src/library/tableIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const wield = (s: GameState, itemId: string) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'w', itemId, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  fit(s.player, itemId);
};
const hit = (itemId: string, target: string, perk?: string, part?: string, armor?: string, d100 = 95, modeId?: string) => {
  const s = makeVillage();
  wield(s, itemId);
  place(s, target, s.player.zone);
  if (armor) fit(s.actors.find((a) => a.id === target)!, armor).core.inventory.push({ id: 'arm', itemId: armor, equippedIn: ['armor'] });
  if (perk) give(s.player, perk);
  const rolls: RollRequest[] = [];
  const real = ruleset.roll;
  const spy = vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => { rolls.push(req); return real(req, st, rng); });
  const r = ruleset.attack({ attackerId: 'player', targetId: target, weaponId: 'w', ...(modeId ? { modeId } : {}), targetPart: part ?? null, aimed: !!part }, s, forcedRng([d100, 5, 50, 50]));
  spy.mockRestore();
  return { r, aim: rolls[0].modifiers.find((m) => m.source.startsWith('aim'))?.value, perkMods: r.attack.modifiers.filter((m) => m.type === 'roll_perk') };
};
const punch = (perk?: string) => {
  const s = makeVillage();
  place(s, 'patron_1', s.player.zone);
  if (perk) give(s.player, perk);
  return ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: `natural:${AM.punch}`, modeId: AM.punch, targetPart: null, aimed: false }, s, forcedRng([85, 5, 50, 50]));
};
afterEach(() => vi.restoreAllMocks());

describe('118 40/80/120 perks', () => {
  it('true skill: +5 in the skill, +1 in it and in skills sharing its function, and the synergic pick', () => {
    const s = makeVillage();
    const p = s.player;
    for (const k of [SK.melee_light, SK.melee_medium, SK.melee_heavy, SK.parry, SK.dodge, SK.eyesight]) p.core.skills[k] = { ...p.core.skills[k], raw: 30, state: p.core.skills[k]?.state ?? 'normal' };
    const before = Object.fromEntries([SK.melee_light, SK.melee_medium, SK.melee_heavy, SK.parry, SK.dodge, SK.eyesight].map((k) => [k, trueSkill(p, k)]));
    give(p, PK.guard_drill);
    expect(trueSkill(p, SK.melee_medium)).toBe(before[SK.melee_medium] + 6); // +5, and +1 for its function (including itself)
    expect(trueSkill(p, SK.melee_light)).toBe(before[SK.melee_light] + 1);
    expect(trueSkill(p, SK.melee_heavy)).toBe(before[SK.melee_heavy] + 1);
    expect(trueSkill(p, SK.parry)).toBe(before[SK.parry] + 10);
    expect(trueSkill(p, SK.dodge)).toBe(before[SK.dodge]);
    expect(trueSkill(p, SK.eyesight)).toBe(before[SK.eyesight]);
  });
  it('Keen Edge: +10 to hit with any melee attack; Steady Draw: +5 to hit and ×1.1 damage with any ranged attack, by the attack, not the skill', () => {
    expect(hit(IT.dagger, 'patron_1', PK.keen_edge).perkMods).toEqual([{ source: 'Keen Edge', type: 'roll_perk', value: 10 }]);
    expect(hit(IT.longbow, 'patron_1', PK.keen_edge).perkMods).toEqual([]); // not ranged
    expect(hit(IT.longbow, 'patron_1', PK.steady_draw).perkMods).toEqual([{ source: 'Steady Draw', type: 'roll_perk', value: 5 }]);
    expect(hit(IT.dagger, 'patron_1', PK.steady_draw).perkMods).toEqual([]);
    const plain = hit(IT.longbow, 'patron_1', undefined, undefined, undefined, 85).r.damage; // both rolls in the same tier
    expect(plain).toBeGreaterThan(0);
    expect(hit(IT.longbow, 'patron_1', PK.steady_draw, undefined, undefined, 85).r.damage).toBeCloseTo(plain * 1.1, 5);
    // melee or ranged in general goes by the attack: a punch is melee, a thrown dagger is ranged
    expect(punch(PK.keen_edge)!.attack.modifiers.filter((m) => m.type === 'roll_perk')).toEqual([{ source: 'Keen Edge', type: 'roll_perk', value: 10 }]);
    expect(hit(IT.dagger, 'patron_1', PK.keen_edge, undefined, undefined, 95, AM.throw).perkMods).toEqual([]);
    expect(hit(IT.dagger, 'patron_1', PK.steady_draw, undefined, undefined, 95, AM.throw).perkMods).toEqual([{ source: 'Steady Draw', type: 'roll_perk', value: 5 }]);
  });
  it('Iron Grip: +10 on every grapple roll, attack or not', () => {
    const s = makeVillage();
    give(s.player, PK.iron_grip);
    const r = ruleset.roll({ actorId: 'player', skill: SK.unarmed_grapple, modifiers: [], tierShifts: [] }, s, forcedRng([50]));
    expect(r.modifiers).toContainEqual({ source: 'Iron Grip', type: 'roll_perk', value: 10 });
    const d = ruleset.roll({ actorId: 'player', skill: SK.dodge, modifiers: [], tierShifts: [] }, s, forcedRng([50]));
    expect(d.modifiers.some((m) => m.type === 'roll_perk')).toBe(false);
  });
  it('Heavy Hand: melee damage ×1.2, weapons of any weight and unarmed blows alike', () => {
    const plain = hit(IT.greataxe, 'patron_1', undefined, undefined, undefined, 85).r, boosted = hit(IT.greataxe, 'patron_1', PK.heavy_hand, undefined, undefined, 85).r;
    expect(plain.damage).toBeGreaterThan(0);
    expect(boosted.damage).toBeCloseTo(plain.damage * 1.2, 5);
    expect(hit(IT.longbow, 'patron_1', PK.heavy_hand, undefined, undefined, 85).r.damage).toBe(hit(IT.longbow, 'patron_1', undefined, undefined, undefined, 85).r.damage); // not ranged
    expect(punch()!.damage).toBeGreaterThan(0);
    expect(punch(PK.heavy_hand)!.damage).toBeCloseTo(punch()!.damage * 1.2, 5); // melee in general: a punch too
    const thrown = (perk?: string) => hit(IT.dagger, 'patron_1', perk, undefined, undefined, 85, AM.throw).r.damage;
    expect(thrown()).toBeGreaterThan(0);
    expect(thrown(PK.heavy_hand)).toBe(thrown()); // a thrown dagger is a ranged attack, though it rolls a melee weapon skill
  });
  it('Armor Piercer: each armor stops 2 less of any ranged hit', () => {
    const plain = hit(IT.crossbow, 'patron_1', undefined, 'left_leg', IT.plate_harness).r;
    const pierced = hit(IT.crossbow, 'patron_1', PK.armor_piercer, 'left_leg', IT.plate_harness).r;
    expect(pierced.location).toBe('left_leg');
    expect(pierced.damage).toBeGreaterThan(plain.damage);
    const thrown = hit(IT.dagger, 'patron_1', undefined, 'left_leg', IT.plate_harness, 95, AM.throw).r, thrownPierced = hit(IT.dagger, 'patron_1', PK.armor_piercer, 'left_leg', IT.plate_harness, 95, AM.throw).r;
    expect(thrownPierced.location).toBe('left_leg');
    expect(thrownPierced.damage).toBeGreaterThan(thrown.damage); // a ranged hit in general: a throw too
    expect(hit(IT.crossbow, 'patron_1', PK.armor_piercer, undefined, undefined, 85).r.damage).toBe(hit(IT.crossbow, 'patron_1', undefined, undefined, undefined, 85).r.damage); // no armor: no change
  });
  it('Quick Mend (Fast Healer) doubles natural recovery and natural composure (morale)', () => {
    const mended = (perk: boolean) => {
      const s = makeVillage();
      s.player.core.condition.hpLostPct = 30;
      s.player.core.condition.moraleLost = 50;
      s.player.core.skills[SK.resolve] = { raw: 30, state: 'normal' };
      if (perk) give(s.player, PK.quick_mend);
      passiveHealing(s, 120);
      // per point: the +5 true skill counts too
      return { hp: (30 - s.player.core.condition.hpLostPct) / trueSkill(s.player, SK.endurance), calm: 50 - (s.player.core.condition.moraleLost ?? 0) };
    };
    const plain = mended(false), fast = mended(true);
    expect(plain.hp).toBeGreaterThan(0);
    expect(plain.calm).toBeGreaterThan(0);
    expect(fast.hp).toBeCloseTo(plain.hp * 2, 5);
    expect(fast.calm).toBeCloseTo(plain.calm * 2, 5);
  });
});

