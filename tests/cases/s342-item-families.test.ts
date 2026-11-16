// IR30-IR33: item families. Every equipment piece names its family. A Mundane piece takes every number from its level (need)
// through one factor each, plus its gear class and gear type, and sets nothing by hand (IR31). A minted piece stays Mundane
// (IR32). A special family stands on a Mundane base and adds its own extras (IR33).
import { describe, expect, it } from 'vitest';
import { getLibrary, itemDef } from '../../src/library';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { IF } from '../../src/library/tableIds';
import { equipNeed } from '../../src/ruleset/requirements';
import { makeVillage } from '../harness';
import { mint } from '../../src/scenario/apply';
import type { ItemDef } from '../../src/types';

const GEAR = ['weapon', 'armor', 'shield', 'accessory'];

/** what a Mundane piece of this class, type and level must carry: every number from the level, nothing by hand */
function mundaneProblems(d: ItemDef): string[] {
  const lib = getLibrary(), bad: string[] = [];
  const need = equipNeed(d.level!);
  if (d.value !== undefined || d.boon !== undefined) bad.push('hand-set value or boon');
  if (d.armor) {
    if (d.armor.reduction !== CONFIG.ARMOR_FACTOR * need) bad.push(`reduction ${d.armor.reduction}`);
    if (d.armor.multiplier !== (need ? CONFIG.ARMOR_MULTIPLIER[d.armor.weight] : 1)) bad.push(`multiplier ${d.armor.multiplier}`);
    if (d.armor.pools) bad.push('hand-set pools');
    if (d.armor.speed) bad.push('hand-set speed');
    const t = d.gearType ? lib.gearTypes?.[d.gearType] : undefined;
    if (!t?.covers) bad.push('armor with no gear type coverage');
  }
  if (d.shield && d.shield.pool !== CONFIG.POOL_BASE + CONFIG.POOL_FACTOR * need) bad.push(`shield pool ${d.shield.pool}`);
  for (const e of d.effects ?? []) {
    const ok = e.kit || e.byLevel || (e.armorWeight && d.armor && e.value === CONFIG.ARMOR_DODGE[d.armor.weight]);
    if (!ok) bad.push(`hand-set effect ${e.skill ?? e.roll} ${e.value}`);
  }
  const improvised = d.tags?.includes('improvised');
  for (const m of d.weapon?.modes ?? []) {
    if (m.damageAdj !== undefined) bad.push(`${m.id} damageAdj`);
    if (m.hitAdj !== undefined && !(improvised && m.hitAdj === CONFIG.IMPROVISED_HIT_ADJ)) bad.push(`${m.id} hitAdj ${m.hitAdj}`);
    if (m.thrown) { if (!Object.values(CONFIG.THROW_M).includes(m.reachM)) bad.push(`${m.id} thrown reach ${m.reachM}`); }
    else if (!improvised && m.reachM !== lib.gearTypes?.[d.gearType ?? '']?.reachM) bad.push(`${m.id} reach not from its type`);
  }
  return bad;
}

describe('342 item families', () => {
  it('IR30: every equipment piece names a family from the families table; ordinary gear is Mundane', () => {
    const lib = getLibrary();
    expect(Object.values(lib.itemFamilies!).map((f) => f.name)).toEqual(['Mundane', 'Threadbound', 'Relic']);
    for (const d of Object.values(lib.items)) {
      if (GEAR.includes(d.kind) || d.threadbound) expect(lib.itemFamilies![d.family!], d.id).toBeDefined();
      else expect(d.family, d.id).toBeUndefined();
    }
    expect(lib.items[IT.arming_sword].family).toBe(IF.mundane);
    expect(lib.items[IT.spectacles].family).toBe(IF.mundane);
    const loop = Object.values(lib.items).find((d) => d.threadbound)!;
    expect(loop.family).toBe(IF.threadbound);
  });

  it('IR31: a Mundane piece takes every number from its level, class and type; nothing is set by hand', () => {
    const mundane = Object.values(getLibrary().items).filter((d) => d.family === IF.mundane);
    expect(mundane.length).toBeGreaterThan(60);
    for (const d of mundane) expect(mundaneProblems(d), d.id).toEqual([]);
  });

  it('IR31: the plate harnesses carry no hand-set head pool (the head is a helmet\'s job)', () => {
    const I = getLibrary().items;
    expect(I[IT.plate_harness].armor!.pools).toBeUndefined();
    expect(I[IT.peerless_plate].armor!.pools).toBeUndefined();
  });

  it('IR32: a minted piece stays Mundane; its quality adds factor × need × quality on top of its level', () => {
    const s = makeVillage();
    const d = itemDef(s, mint(s, { base: IT.mail_hauberk, quality: 'quality_2', boosts: 'hitAdj', name: 'a find', look: 'a find' }, 1));
    expect(d.family).toBe(IF.mundane);
    expect(d.base).toMatchObject({ itemId: IT.mail_hauberk, quality: 'quality_2' });
  });
});
