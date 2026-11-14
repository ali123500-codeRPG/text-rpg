// 323 Accessories: five accessory slots; spectacles sharpen Eyesight while worn; a charmed ring boosts one skill, rolled
// for each ring from its id, so the same ring always boosts the same skill.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { getLibrary } from '../../src/library';
import { applyGearOps } from '../../src/engine/gear';
import { effectiveSkill, rolledPool, rolledSkill } from '../../src/ruleset/gear';
import { itemValue } from '../../src/ruleset/value';
import { itemRows } from '../../src/ui/pages';
import { skillName } from '../../src/library/skillNames';
import type { GameState } from '../../src/types';

const eff = (s: GameState, skill: string) => effectiveSkill(s, s.player, skill).value;
const bare = (s: GameState) => { s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.some((x) => x.startsWith('acc:'))); return s; };
/** a ring id whose rolled skill is `want` (or differs from `not`) */
const ringId = (s: GameState, ok: (k: string) => boolean) => { for (let n = 0; ; n++) if (ok(rolledSkill(s, { id: `ring${n}` }))) return `ring${n}`; };

describe('323 accessories', () => {
  it('there are five accessory slots: a sixth accessory is not worn', () => {
    expect(CONFIG.ACCESSORY_SLOTS).toBe(5);
    const s = bare(makeVillage());
    for (let n = 0; n < 6; n++) s.player.core.inventory.push({ id: `sig${n}`, itemId: IT.signet_ring });
    applyGearOps(s, s.player, Array.from({ length: 6 }, (_, n) => ({ op: 'wear_acc' as const, item: `sig${n}` })));
    const worn = s.player.core.inventory.filter((i) => i.id.startsWith('sig') && i.equippedIn?.length);
    expect(worn.map((i) => i.equippedIn![0]).sort()).toEqual(['acc:0', 'acc:1', 'acc:2', 'acc:3', 'acc:4']);
  });

  it('spectacles add their Eyesight bonus only while worn, and are priced from it', () => {
    const s = bare(makeVillage()), before = eff(s, SK.eyesight);
    const bonus = getLibrary().items[IT.spectacles].effects![0].value;
    s.player.core.inventory.push({ id: 'specs', itemId: IT.spectacles });
    expect(eff(s, SK.eyesight)).toBeCloseTo(before);
    applyGearOps(s, s.player, [{ op: 'wear_acc', item: 'specs' }]);
    expect(eff(s, SK.eyesight)).toBeCloseTo(before + bonus);
    expect(itemValue(s, getLibrary().items[IT.spectacles])).toBe(bonus * CONFIG.ITEM_VALUE.skillPoint);
  });

  it('a charmed ring boosts one tier 2 skill, fixed for that ring, shown on its panel', () => {
    const s = bare(makeVillage());
    expect(rolledPool().length).toBeGreaterThan(10);
    expect(rolledPool()).not.toContain(SK.tremor); // tier 0
    const id = ringId(s, (k) => !!s.player.core.skills[k]), skill = rolledSkill(s, { id });
    expect(rolledSkill(s, { id })).toBe(skill); // the same ring always rolls the same skill
    const bonus = getLibrary().items[IT.charmed_ring].effects![0].value, before = eff(s, skill);
    s.player.core.inventory.push({ id, itemId: IT.charmed_ring });
    applyGearOps(s, s.player, [{ op: 'wear_acc', item: id }]);
    expect(eff(s, skill)).toBeCloseTo(before + bonus);
    expect(itemRows(s, { id, itemId: IT.charmed_ring }).some((r) => String(r.v).includes(skillName(skill)))).toBe(true);
  });

  it('two charmed rings on the same skill count once; on different skills both count', () => {
    const s = bare(makeVillage());
    const a = ringId(s, (k) => !!s.player.core.skills[k]), skill = rolledSkill(s, { id: a });
    let same = ''; for (let n = 0; !same; n++) if (`twin${n}` !== a && rolledSkill(s, { id: `twin${n}` }) === skill) same = `twin${n}`;
    const other = ringId(s, (k) => k !== skill && !!s.player.core.skills[k]), otherSkill = rolledSkill(s, { id: other });
    const bonus = getLibrary().items[IT.charmed_ring].effects![0].value;
    const b0 = eff(s, skill), o0 = eff(s, otherSkill);
    s.player.core.inventory.push({ id: a, itemId: IT.charmed_ring }, { id: same, itemId: IT.charmed_ring }, { id: other, itemId: IT.charmed_ring });
    applyGearOps(s, s.player, [a, same, other].map((item) => ({ op: 'wear_acc' as const, item })));
    expect(eff(s, skill)).toBeCloseTo(b0 + bonus);
    expect(eff(s, otherSkill)).toBeCloseTo(o0 + bonus);
  });
});
