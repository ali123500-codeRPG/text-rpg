// IR2, IR3, IR5, IR7, IR8: a piece for every gear class and level to Masterwork, equip levels past Masterwork with no top, priced items carry no hand-set value, quality 2 is
// Sound, and armor covers what its real garment covers.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';
import { GC } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import { EQUIP_LEVELS, FRAGILITY, QUALITY_LEVELS, equipAt, equipName, equipPos } from '../../src/scales';
import { equipNeed, itemLevel, requirement } from '../../src/ruleset/requirements';
import { itemValue } from '../../src/ruleset/value';
import type { ItemDef } from '../../src/types';

const item = (id: string) => getLibrary().items[id];

describe('336 equip ladder', () => {
  it('IR3: levels go on past Masterwork with the grade names, then Divine+ with no top', () => {
    expect(['masterwork', 'beyond', 'mythic', 'transcendent', 'divine'].map((k) => equipNeed(k as never))).toEqual([100, 150, 200, 300, 400]);
    const past = equipAt(EQUIP_LEVELS.keys.length + 1); // two steps past Divine
    expect(past).toBe('divine_2');
    expect(equipName(past)).toBe('Divine++');
    expect(equipNeed(past)).toBe(400 + 2 * CONFIG.EQUIP_BEYOND_STEP);
    expect(equipPos(past)).toBeGreaterThan(equipPos('divine'));
    // a minted Divine piece of Exceptional quality moves a level up, past the last row (EQ11 has no top)
    const minted = { ...item(IT.greataxe), level: 'divine', base: { itemId: IT.greataxe, quality: CONFIG.QUALITY_LEVEL_UP_FROM, boosts: 'hitAdj' } } as ItemDef;
    expect(itemLevel(minted)).toBe('divine_1');
    expect(requirement(minted)!.need).toBe(500);
  });

  it('IR5: priced items carry no hand-set value; unpriced ones keep theirs', () => {
    for (const d of Object.values(getLibrary().items)) if (d.weapon || d.armor || d.shield) expect(d.value, d.id).toBeUndefined();
    expect(itemValue(null, item(IT.coin))).toBe(1);
    expect(itemValue(null, item(IT.plate_harness))).toBeGreaterThan(0);
  });

  it('IR7: quality 2 is Sound, a word fragility never uses', () => {
    expect(QUALITY_LEVELS.name('quality_2')).toBe('Sound');
    const fragility = new Set(FRAGILITY.keys.map((k) => FRAGILITY.name(k)));
    for (const k of QUALITY_LEVELS.keys) expect(fragility.has(QUALITY_LEVELS.name(k))).toBe(false);
  });

  it('IR2: every gear class but improvised has a piece at every level from Common to Masterwork; Masterwork ones are fantasy', () => {
    const lib = getLibrary(), items = Object.values(lib.items);
    for (const gc of Object.keys(lib.gearClasses ?? {})) {
      if (gc === GC.improvised) continue;
      for (const lv of ['common', 'fine', 'superior', 'masterwork']) expect(items.some((d) => d.gearClass === gc && d.level === lv), `${gc} ${lv}`).toBe(true);
    }
    for (const d of items) if (d.level === 'masterwork') expect(d.tags, d.id).toContain('fantasy');
  });

  it('IR23: every weapon and armor piece outside improvised and shields has a gear type, and its reach or coverage is the type\'s', () => {
    const lib = getLibrary(), types = lib.gearTypes ?? {};
    for (const d of Object.values(lib.items)) {
      if (!d.gearClass || d.gearClass === GC.improvised || d.gearClass === GC.shield) continue;
      const t = types[d.gearType ?? ''];
      expect(t, d.id).toBeDefined();
      // SZ8: a melee type gives its length past the hand (its library reach is a standard arm + that); a bow its range
      for (const m of d.weapon?.modes ?? []) if (!m.thrown) expect(t.lengthM !== undefined ? m.lengthM : m.reachM, d.id).toBe(t.lengthM ?? t.reachM);
      if (d.armor) expect(d.armor.covers, d.id).toEqual(t.covers);
    }
    expect(item(IT.rapier).weapon!.modes[0].lengthM).toBe(0.9); // a Sword: rounds to its type
    expect(item(IT.dagger).weapon!.modes.find((m) => m.thrown)!.reachM).toBe(CONFIG.THROW_M.knife); // a throw keeps the throw table
  });
});
