// Weapon damage grows with the weapon's requirement (CE11): (class damage + damageAdj) × (1 + DAMAGE_NEED_RATE × need).
// A natural attack or a bare hand has no requirement, so the attacker's skill with it stands in (CE8).
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { blowDamage, damageNeed, effectiveSkill, usableModes } from '../../src/ruleset';
import { modeDps } from '../../src/ruleset/value';
import { requirement } from '../../src/ruleset/requirements';
import { damageGrowth } from '../../src/library/gearScale';
import { refFighter } from '../../src/engine/combatLevel';
import { equipLoadout, spawnNpc } from '../../src/library/spawn';
import { itemDef } from '../../src/library';
import { TP } from '../../src/library/templateIds';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';

const fighter = (S: GameState, id: string, skills: Record<string, number>, kit: string[] = []): Actor => {
  const a = refFighter(S, 0, id).ref;
  a.core.skills = Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { raw: v, state: 'normal' as const }]));
  a.core.inventory = equipLoadout(S, kit, id);
  return a;
};
/** the raw blow of the actor's mode from this item, at a multiplier of 1 (the damage step on a shield: no armor) */
const raw = (S: GameState, a: Actor, itemId: string) => {
  const m = usableModes(S, a).find((x) => x.itemId === itemId)!;
  return blowDamage(S, a, a, m.mode, 'shield', 1, null, m.itemId).damage;
};

describe('weapon damage grows with the requirement (CE11)', () => {
  it('a made weapon multiplies its class damage by its own requirement, whoever holds it', () => {
    const S = makeVillage({ seed: 1 });
    const sword = itemDef(S, IT.arming_sword), medium = CONFIG.WEAPON_CLASSES.medium.damage;
    expect(requirement(sword)?.need).toBe(50);
    for (const skill of [0, 50, 200]) {
      const a = fighter(S, 'a' + skill, { [SK.melee_medium]: skill }, [IT.arming_sword]);
      expect(raw(S, a, a.core.inventory[0].id)).toBeCloseTo(medium * 1.5, 9);
    }
    // the standard soldier's relic sword asks for its level
    for (const L of [0, 100, 200]) {
      const { S: S2, ref } = refFighter(S, L, 'r' + L);
      const held = ref.core.inventory.find((i) => itemDef(S2, i.itemId).weapon)!;
      expect(raw(S2, ref, held.id)).toBeCloseTo(medium * (1 + L / 100), 9);
    }
  });
  it('fists and natural attacks grow with the attacker\'s own skill with them (CE8)', () => {
    const S = makeVillage({ seed: 1 });
    for (const skill of [0, 50, 150]) {
      const a = fighter(S, 'b' + skill, { [SK.unarmed_strike]: skill });
      const punch = usableModes(S, a).find((m) => m.mode.skill === SK.unarmed_strike)!;
      const own = effectiveSkill(S, a, SK.unarmed_strike, { itemId: punch.itemId }).value;
      expect(damageNeed(S, a, punch.mode, punch.itemId)).toBe(own);
      expect(raw(S, a, punch.itemId)).toBeCloseTo(CONFIG.UNARMED_PROFILE.damage * damageGrowth(own), 9);
    }
    const wolf = spawnNpc(S, TP.wolf, { id: 'w', zone: S.player.zone, placeId: S.player.placeId } as never, createRng(3));
    const bite = usableModes(S, wolf)[0];
    expect(bite.itemId.startsWith('natural:')).toBe(true);
    expect(damageNeed(S, wolf, bite.mode, bite.itemId)).toBe(effectiveSkill(S, wolf, bite.mode.skill!, { itemId: bite.itemId }).value);
    expect(damageNeed(S, wolf, bite.mode, bite.itemId)).toBeGreaterThan(0);
  });
  it('a held weapon is found by its mode when no item is named, and a fist beside it still reads the skill', () => {
    const S = makeVillage({ seed: 1 });
    const a = fighter(S, 'c', { [SK.melee_medium]: 50, [SK.unarmed_strike]: 30 }, [IT.arming_sword]);
    const modes = usableModes(S, a), cut = modes.find((m) => m.itemId === a.core.inventory[0].id)!, punch = modes.find((m) => m.mode.skill === SK.unarmed_strike)!;
    expect(damageNeed(S, a, cut.mode)).toBe(50);
    expect(damageNeed(S, a, punch.mode)).toBe(effectiveSkill(S, a, SK.unarmed_strike).value);
  });
  it('an item\'s worth follows the damage it really does (one equation)', () => {
    const S = makeVillage({ seed: 1 });
    const sword = itemDef(S, IT.arming_sword), mode = sword.weapon!.modes[0];
    const { S: S2, ref } = refFighter(S, 100, 'r');
    const relic = itemDef(S2, ref.core.inventory.find((i) => itemDef(S2, i.itemId).weapon)!.itemId);
    expect(modeDps(relic, relic.weapon!.modes[0]) / modeDps(sword, mode)).toBeCloseTo(damageGrowth(100) / damageGrowth(50), 9);
  });
});
