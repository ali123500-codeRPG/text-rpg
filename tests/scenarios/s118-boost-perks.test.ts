// 118 40/80/120 perks (Ali, 08/11/2026, "40 milestone perks: options"): +5 true skill in the skill, +1 in every other skill
// sharing a function, plus one number. Darkness never helps a sneaker against a listener (P14).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRng, forcedRng, makeVillage, place } from '../harness';
import { ruleset, trueSkill } from '../../src/ruleset';
import { passiveHealing } from '../../src/engine/heal';
import { resolveTurn } from '../../src/engine';
import { getLibrary } from '../../src/library';
import type { Actor, ContestResult, GameState, Intent, RollRequest } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const wield = (s: GameState, itemId: string) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'w', itemId, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
};
const hit = (itemId: string, target: string, perk?: string, part?: string, armor?: string) => {
  const s = makeVillage();
  wield(s, itemId);
  place(s, target, s.player.zone);
  if (armor) s.actors.find((a) => a.id === target)!.core.inventory.push({ id: 'arm', itemId: armor, equippedIn: ['armor'] });
  if (perk) give(s.player, perk);
  const rolls: RollRequest[] = [];
  const real = ruleset.roll;
  const spy = vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => { rolls.push(req); return real(req, st, rng); });
  const r = ruleset.attack({ attackerId: 'player', targetId: target, weaponId: 'w', targetPart: part ?? null, aimed: !!part }, s, forcedRng([95, 5, 50, 50]));
  spy.mockRestore();
  return { r, aim: rolls[0].modifiers.find((m) => m.source.startsWith('aim'))?.value, perkMods: r.attack.modifiers.filter((m) => m.type === 'roll_perk') };
};
afterEach(() => vi.restoreAllMocks());

describe('118 40/80/120 perks', () => {
  it('every 40/80/120 perk is a built 40 milestone perk with +5 true skill and no conditions', () => {
    const boosts = Object.values(getLibrary().perks).filter((d) => d.ladder?.milestone === 40);
    expect(boosts.length).toBeGreaterThanOrEqual(11);
    for (const d of boosts) {
      expect(d.trueSkill).toBe(5);
      expect(d.functionBoost).toBe(1);
      expect(d.built).toBe(true);
      expect(d.rules?.conditions).toEqual([]);
      expect(!!d.numbers !== !!d.trueSkillTo).toBe(true); // exactly one more number
    }
  });
  it('true skill: +5 in the skill, +1 in it and in skills sharing its function, and the synergic pick', () => {
    const s = makeVillage();
    const p = s.player;
    for (const k of ['melee_light', 'melee_medium', 'melee_heavy', 'block', 'dodge', 'sight']) p.core.skills[k] = { ...p.core.skills[k], raw: 30, state: p.core.skills[k]?.state ?? 'normal' };
    const before = Object.fromEntries(['melee_light', 'melee_medium', 'melee_heavy', 'block', 'dodge', 'sight'].map((k) => [k, trueSkill(p, k)]));
    give(p, 'guard_drill');
    expect(trueSkill(p, 'melee_medium')).toBe(before.melee_medium + 6); // +5, and +1 for its function (Ali: including itself)
    expect(trueSkill(p, 'melee_light')).toBe(before.melee_light + 1);
    expect(trueSkill(p, 'melee_heavy')).toBe(before.melee_heavy + 1);
    expect(trueSkill(p, 'block')).toBe(before.block + 10);
    expect(trueSkill(p, 'dodge')).toBe(before.dodge);
    expect(trueSkill(p, 'sight')).toBe(before.sight);
  });
  it('Keen Edge: +10 to hit with light weapons only; Steady Draw: +5 to hit and ×1.1 damage with medium ranged', () => {
    expect(hit('dagger', 'patron_1', 'keen_edge').perkMods).toEqual([{ source: 'Keen Edge', type: 'roll_perk', value: 10 }]);
    expect(hit('greataxe', 'patron_1', 'keen_edge').perkMods).toEqual([]);
    expect(hit('dagger', 'patron_1').perkMods).toEqual([]);
    expect(hit('longbow', 'patron_1', 'steady_draw').perkMods).toEqual([{ source: 'Steady Draw', type: 'roll_perk', value: 5 }]);
    const plain = hit('longbow', 'patron_1').r.damage;
    expect(plain).toBeGreaterThan(0);
    expect(hit('longbow', 'patron_1', 'steady_draw').r.damage).toBeCloseTo(plain * 1.1, 5);
  });
  it('Iron Grip: +10 on every grapple roll, attack or not', () => {
    const s = makeVillage();
    give(s.player, 'iron_grip');
    const r = ruleset.roll({ actorId: 'player', skill: 'unarmed_grapple', modifiers: [], tierShifts: [] }, s, forcedRng([50]));
    expect(r.modifiers).toContainEqual({ source: 'Iron Grip', type: 'roll_perk', value: 10 });
    const d = ruleset.roll({ actorId: 'player', skill: 'dodge', modifiers: [], tierShifts: [] }, s, forcedRng([50]));
    expect(d.modifiers.some((m) => m.type === 'roll_perk')).toBe(false);
  });
  it('Heavy Hand: heavy melee damage ×1.2', () => {
    const plain = hit('greataxe', 'patron_1').r, boosted = hit('greataxe', 'patron_1', 'heavy_hand').r;
    expect(plain.damage).toBeGreaterThan(0);
    expect(boosted.damage).toBeCloseTo(plain.damage * 1.2, 5);
    expect(hit('dagger', 'patron_1', 'heavy_hand').r.damage).toBe(hit('dagger', 'patron_1').r.damage);
  });
  it('Armor Piercer: each armor stops 2 less of a heavy ranged hit', () => {
    const plain = hit('crossbow', 'patron_1', undefined, 'left_leg', 'plate_harness').r;
    const pierced = hit('crossbow', 'patron_1', 'armor_piercer', 'left_leg', 'plate_harness').r;
    expect(pierced.location).toBe('left_leg');
    expect(pierced.damage).toBeGreaterThan(plain.damage);
    expect(hit('crossbow', 'patron_1', 'armor_piercer').r.damage).toBe(hit('crossbow', 'patron_1').r.damage); // no armor: no change
  });
  it('Quick Mend doubles natural recovery', () => {
    const healed = (perk: boolean) => {
      const s = makeVillage();
      s.player.core.condition.hpLostPct = 30;
      if (perk) give(s.player, 'quick_mend');
      passiveHealing(s, 120);
      return (30 - s.player.core.condition.hpLostPct) / trueSkill(s.player, 'endurance'); // per point: the +5 true skill counts too
    };
    expect(healed(false)).toBeGreaterThan(0);
    expect(healed(true)).toBeCloseTo(healed(false) * 2, 5);
  });
});

describe('118 darkness and hearing (P14)', () => {
  it('darkness helps a hide against a watcher but not against a listener', () => {
    const s = makeVillage();
    place(s, 'player', 'tav_cellar');
    place(s, 'trader', 'tav_cellar');
    const calls: [RollRequest, RollRequest][] = [];
    const real = ruleset.contested;
    vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => { calls.push([a, b]); return { ...real(a, b, st, rng), gap: -1 } as ContestResult; });
    const i: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
      action: { type: 'hide', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } };
    s.turn += 1;
    resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
    const [mine, theirs] = calls.find(([, b]) => b.actorId === 'trader')!;
    expect(mine.modifiers).toEqual(theirs.skill === 'sight' ? [{ source: 'light', type: 'situational', value: 10 }] : []);
  });
});
