// IR19, IR21, IR24: several armor pieces can be worn when no body part is covered twice (a helmet beside body armor);
// their weight costs each count, stacked by the one stacking rule; helmets fill every armor weight to Masterwork.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { equipArmor } from '../../src/engine/gear';
import { moveSpeed } from '../../src/engine/speed';
import { effectiveSkill } from '../../src/ruleset/gear';
import { pieceOn, wornPieces } from '../../src/ruleset/worn';
import { powerStack } from '../../src/ruleset/stacking';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';

const setup = () => {
  const s = makeVillage(), p = s.player;
  p.core.inventory = p.core.inventory.filter((i) => !getLibrary().items[i.itemId]?.armor);
  for (const id of [IT.mail_hauberk, IT.kettle_hat, IT.plate_harness]) p.core.inventory.push({ id, itemId: id });
  return { s, p };
};
const worn = (s: ReturnType<typeof setup>['s']) => wornPieces(s, s.player).map((w) => w.inst.itemId).sort();

describe('337 worn pieces', () => {
  it('IR19: a helmet goes on beside body armor; a piece covering a worn part takes that piece off', () => {
    const { s, p } = setup();
    expect(equipArmor(s, p, IT.mail_hauberk)).toBe(true);
    expect(equipArmor(s, p, IT.kettle_hat)).toBe(true);
    expect(worn(s)).toEqual([IT.mail_hauberk, IT.kettle_hat].sort());
    expect(pieceOn(s, p, 'head')?.inst.itemId).toBe(IT.kettle_hat);
    expect(pieceOn(s, p, 'left_arm')?.inst.itemId).toBe(IT.mail_hauberk);
    expect(equipArmor(s, p, IT.plate_harness)).toBe(true); // covers torso, arms and head: both come off
    expect(worn(s)).toEqual([IT.plate_harness]);
    expect(equipArmor(s, p, IT.kettle_hat)).toBe(true); // the head is the harness's: it comes off
    expect(worn(s)).toEqual([IT.kettle_hat]);
  });

  it('IR24 a: Dodge, slowing and noise from several pieces stack by the stacking rule', () => {
    const { s, p } = setup();
    p.core.skills[SK.dodge] = { raw: 40, state: 'normal' } as never;
    const bare = effectiveSkill(s, p, SK.dodge).value, speed = moveSpeed(s, p).walk;
    equipArmor(s, p, IT.mail_hauberk);
    equipArmor(s, p, IT.kettle_hat);
    const m = CONFIG.ARMOR_DEFENSE_COST.medium * CONFIG.EQUIP_NEED.fine, slow = CONFIG.ARMOR_SPEED.medium;
    expect(effectiveSkill(s, p, SK.dodge).value).toBeCloseTo(bare + powerStack([m, m], CONFIG.MOD_STACK_EXP), 9); // −14.1, not −20
    expect(effectiveSkill(s, p, SK.dodge).gear.filter((g) => g.source.startsWith('Armor weight'))).toHaveLength(1);
    const flat = powerStack([slow.flat, slow.flat], CONFIG.MOD_STACK_EXP), pct = powerStack([slow.pct, slow.pct], CONFIG.MOD_STACK_EXP);
    expect(moveSpeed(s, p).walk).toBeCloseTo((speed - flat) * (1 - pct), 9);
  });

});
