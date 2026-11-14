// 323 Accessories: five accessory slots for every body (AX6 a). Each accessory gives a flat skill bonus while worn, sized
// by its equipment level: Common 5, Fine 10, Superior 15, and on (AX1 d, AX2 c). A charmed ring's skill is rolled once
// for each ring, common trees weighing more (AX4 c), and its name shows the skill (AX3 c). Every accessory worn adds in
// full, copies included (AX5 c). The ear cup, amulet and hooded cloak follow the same rule (AX7).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { TR } from '../../src/library/treeIds';
import { getLibrary } from '../../src/library';
import { applyGearOps } from '../../src/engine/gear';
import { effectValue, effectiveSkill, pieceName, pieceRolledSkill, rolledPool } from '../../src/ruleset/gear';
import { itemValue } from '../../src/ruleset/value';
import { itemRows } from '../../src/ui/pages';
import { skillName } from '../../src/library/skillNames';
import type { GameState } from '../../src/types';

const eff = (s: GameState, skill: string) => effectiveSkill(s, s.player, skill).value;
const bare = (s: GameState) => { s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.some((x) => x.startsWith('acc:'))); return s; };
const lib = () => getLibrary().items;
const ring = (id: string) => ({ id, itemId: IT.charmed_ring });
/** the first ring id `${p}N` whose rolled skill passes ok */
const ringId = (s: GameState, ok: (k: string) => boolean, p = 'ring', skip: string[] = []) => {
  for (let n = 0; ; n++) { const id = `${p}${n}`; if (!skip.includes(id) && ok(pieceRolledSkill(s, ring(id))!)) return id; }
};
const wear = (s: GameState, ...items: { id: string; itemId: string }[]) => {
  s.player.core.inventory.push(...items.map((i) => ({ ...i })));
  applyGearOps(s, s.player, items.map((i) => ({ op: 'wear_acc' as const, item: i.id })));
};

describe('323 accessories', () => {
  it('AX6 a: five accessory slots; a sixth accessory is not worn', () => {
    expect(CONFIG.ACCESSORY_SLOTS).toBe(5);
    const s = bare(makeVillage());
    wear(s, ...Array.from({ length: 6 }, (_, n) => ({ id: `sig${n}`, itemId: IT.signet_ring })));
    const worn = s.player.core.inventory.filter((i) => i.id.startsWith('sig') && i.equippedIn?.length);
    expect(worn.map((i) => i.equippedIn![0]).sort()).toEqual(['acc:0', 'acc:1', 'acc:2', 'acc:3', 'acc:4']);
  });

  it('AX1 d / AX2 c: the bonus follows the equipment level: Common 5, Fine 10, Superior 15, Masterwork 20', () => {
    const d = lib()[IT.spectacles], e = d.effects![0];
    expect([undefined, 'fine', 'superior', 'masterwork'].map((level) => effectValue(level ? { ...d, level: level as 'fine' } : d, e))).toEqual([5, 10, 15, 20]);
    expect(itemValue(null, d)).toBe(5 * CONFIG.ITEM_VALUE.skillPoint);
  });

  it('spectacles add their Eyesight bonus only while worn', () => {
    const s = bare(makeVillage()), before = eff(s, SK.eyesight), bonus = effectValue(lib()[IT.spectacles], lib()[IT.spectacles].effects![0]);
    s.player.core.inventory.push({ id: 'specs', itemId: IT.spectacles });
    expect(eff(s, SK.eyesight)).toBeCloseTo(before);
    applyGearOps(s, s.player, [{ op: 'wear_acc', item: 'specs' }]);
    expect(eff(s, SK.eyesight)).toBeCloseTo(before + bonus);
  });

  it('AX3 c: a ring rolls its skill once, boosts it while worn, and its name and panel show it', () => {
    const s = bare(makeVillage());
    expect(rolledPool()).not.toContain(SK.tremor); // tier 0
    const id = ringId(s, (k) => !!s.player.core.skills[k]), skill = pieceRolledSkill(s, ring(id))!;
    expect(pieceRolledSkill(s, ring(id))).toBe(skill);
    expect(pieceName(s, ring(id))).toBe(`charmed ring (${skillName(skill)})`);
    const before = eff(s, skill);
    wear(s, ring(id));
    expect(eff(s, skill)).toBeCloseTo(before + 5);
    expect(itemRows(s, ring(id)).some((r) => String(r.v).includes(skillName(skill)))).toBe(true);
  });

  it('AX4 c: fighting and sense skills come up more often than class skills', () => {
    const s = makeVillage(), counts: Record<string, number> = {};
    for (let n = 0; n < 4000; n++) { const k = pieceRolledSkill(s, ring(`r${n}`))!; counts[k] = (counts[k] ?? 0) + 1; }
    const tree = (k: string) => getLibrary().skills[k].treeId;
    const per = (t: string) => { const ks = rolledPool().filter((k) => tree(k) === t); return ks.reduce((n, k) => n + (counts[k] ?? 0), 0) / ks.length; };
    expect(per(TR.melee)).toBeGreaterThan(2 * per(TR.swordsman));
    expect(per(TR.perception)).toBeGreaterThan(2 * per(TR.merchant));
  });

  it('AX5 c: every accessory worn adds in full, copies and same-skill rings included', () => {
    const s = bare(makeVillage());
    const a = ringId(s, (k) => !!s.player.core.skills[k]), skill = pieceRolledSkill(s, ring(a))!;
    const b = ringId(s, (k) => k === skill, 'twin');
    const e0 = eff(s, SK.eyesight), r0 = eff(s, skill);
    wear(s, ring(a), ring(b), { id: 'specs1', itemId: IT.spectacles }, { id: 'specs2', itemId: IT.spectacles });
    expect(eff(s, skill)).toBeCloseTo(r0 + 10);
    expect(eff(s, SK.eyesight)).toBeCloseTo(e0 + 10);
  });

  it('AX7: the ear cup, amulet and hooded cloak boost Earshot, Resolve and Sneaking while worn', () => {
    for (const [itemId, skill] of [[IT.ear_cup, SK.earshot], [IT.amulet, SK.resolve], [IT.hooded_cloak, SK.sneaking]] as const) {
      const s = bare(makeVillage()), before = eff(s, skill);
      expect(lib()[itemId].slot).toBe('accessory');
      wear(s, { id: 'acc', itemId });
      expect(eff(s, skill)).toBeCloseTo(before + 5);
    }
  });
});
