// 126 Equip requirements (EQ1–EQ13): each item has an equipment level that asks for true skill in the
// skill that uses it (stand-ins count at their share); every roll with gear you fall short on is one outcome step worse
// per 10 points short; worn armor reaches Dodge and stealth rolls; templates carry what their loadout asks. AR5: a hit
// your armor covers marks the armor skill when the attacker or the armor is near your level.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { ruleset } from '../../src/ruleset';
import { itemLevel, requirement, shortBy, shortShifts } from '../../src/ruleset/requirements';
import { getLibrary, itemDef } from '../../src/library';
import { spawnNpc } from '../../src/library/spawn';
import type { AttackResult, ItemDef } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

const sk = (raw: number) => ({ raw, state: 'normal' as const });

describe('126 Equip requirements', () => {
  it('EQ8–EQ11: levels and what they ask; quality 3 and 4 add a level', () => {
    expect(requirement(itemDef(null, IT.gambeson))).toEqual({ skill: SK.light_armor, level: 'common', need: 25 });
    expect(requirement(itemDef(null, IT.arming_sword))).toEqual({ skill: SK.melee_medium, level: 'fine', need: 50 });
    expect(requirement(itemDef(null, IT.plate_harness))).toEqual({ skill: SK.heavy_armor, level: 'superior', need: 75 });
    expect(requirement(itemDef(null, IT.round_shield))).toEqual({ skill: SK.block, level: 'common', need: 25 });
    expect(requirement(itemDef(null, IT.bandage))).toBeNull();
    const minted = (q: 1 | 2 | 3 | 4, base: string = IT.crossbow): ItemDef => ({ ...itemDef(null, base), base: { itemId: base, quality: (['quality_1', 'quality_2', 'quality_3', 'quality_4'] as const)[q - 1], boosts: '' } });
    expect(itemLevel(minted(2))).toBe('superior');
    expect(itemLevel(minted(3))).toBe('masterwork');
    expect(requirement(minted(4))?.need).toBe(100);
    expect(itemLevel(minted(4, IT.dagger))).toBe('fine');
  });

  it('EQ1/EQ3: true skill counts, and a stand-in at its share', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills[SK.light_armor] = sk(20);
    expect(shortBy(p, itemDef(s, IT.gambeson))).toBe(5);
    delete p.core.skills[SK.light_armor];
    p.core.skills[SK.medium_armor] = sk(50); // Medium Armor stands in for Light Armor at 0.3: 15
    expect(shortBy(p, itemDef(s, IT.gambeson))).toBe(10);
  });

  it('EQ12 c: one outcome step worse per 10 points short, on rolls with the item; armor reaches Dodge and stealth', () => {
    const s = makeVillage();
    const p = s.player; // the harness player wears a gambeson with no Light Armor: 25 short
    p.core.skills[SK.melee_medium] = sk(35); // the arming sword asks 50: 15 short
    const sword = p.core.inventory.find((i) => i.itemId === IT.arming_sword)!.id;
    expect(shortShifts(s, p, 'hit', sword)).toEqual([{ source: "Short of arming sword's requirement", value: -2 }]);
    expect(shortShifts(s, p, 'dodge', undefined)).toEqual([{ source: "Short of gambeson's requirement", value: -3 }]);
    expect(shortShifts(s, p, 'stealth', undefined).map((x) => x.value)).toEqual([-3]);
    expect(shortShifts(s, p, 'perception', undefined)).toEqual([]);
    const r = ruleset.roll({ actorId: 'player', skill: SK.melee_medium, modifiers: [], tierShifts: [], itemId: sword, rollKind: 'hit' }, s, forcedRng([50]));
    expect(r.tierShifts).toContainEqual({ source: "Short of arming sword's requirement", value: -2 });
    p.core.skills[SK.melee_medium] = sk(50);
    p.core.skills[SK.light_armor] = sk(25);
    expect(ruleset.roll({ actorId: 'player', skill: SK.dodge, modifiers: [], tierShifts: [], rollKind: 'dodge' }, s, forcedRng([50])).tierShifts).toEqual([]);
  });

  it('AR5: a hit on a part your armor covers marks its skill when the attacker or the armor is near your level', () => {
    const s = makeVillage();
    const p = s.player, wim = s.actors.find((a) => a.id === 'patron_1')!;
    const hit = (location: string) => ({
      attack: { actorId: 'patron_1', skill: SK.unarmed_strike }, defense: null, location, targetId: 'player',
    }) as unknown as AttackResult;
    const marked = (armor: number, attacker: number, location = 'general') => {
      p.progression!.marks = []; p.progression!.markCounts = {};
      p.core.skills[SK.light_armor] = sk(armor); // gambeson: Common, needs 25
      wim.core.skills[SK.unarmed_strike] = sk(attacker);
      ruleset.recordUse(wim, SK.unarmed_strike, hit(location), s);
      return p.progression!.marks.includes(SK.light_armor);
    };
    expect(marked(25, 30, 'head')).toBe(false); // the gambeson doesn't cover the head
    expect(marked(25, 30)).toBe(true); // both near
    expect(marked(25, 60)).toBe(true); // the armor is near
    expect(marked(50, 45)).toBe(true); // the attacker is near
    expect(marked(50, 70)).toBe(false); // neither
  });

  it('EQ5/AR9: every template meets the requirements of its loadout', () => {
    for (const t of Object.values(getLibrary().templates)) {
      const a = spawnNpc(null, t.id, { id: `x_${t.id}`, zone: 'z', placeId: 'p', bandId: 'b', name: 'X', storyId: 'test' });
      for (const id of t.loadout ?? []) expect([t.id, id, shortBy(a, itemDef(null, id))]).toEqual([t.id, id, 0]);
    }
  });
});
