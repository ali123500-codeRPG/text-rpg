// IR25-IR29: gauntlets are an unarmed weapon. One gear class asking Unarmed strike, a pair held in both grips, one pair per
// level; a punch with them is still a punch, and their kit bonus adds to the Unarmed strike roll.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill, usableModes } from '../../src/ruleset/gear';
import { requirement } from '../../src/ruleset/requirements';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { GC } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';

describe('338 gauntlets', () => {
  it('one gear class asking Unarmed strike; a pair fills both grips; Common to Masterwork', () => {
    const lib = getLibrary();
    expect(lib.gearClasses![GC.gauntlets].skill).toBe(SK.unarmed_strike);
    const pairs = Object.values(lib.items).filter((d) => d.gearClass === GC.gauntlets);
    expect(pairs.map((d) => d.level).sort()).toEqual(['common', 'fine', 'masterwork', 'superior']);
    for (const d of pairs) {
      expect(d.grips, d.id).toBe(2);
      expect(d.armor, d.id).toBeUndefined(); // no coverage (IR25)
      expect(d.weapon!.modes[0]).toMatchObject({ tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike });
    }
    expect(requirement(lib.items[IT.mail_mittens])).toMatchObject({ skill: SK.unarmed_strike, need: CONFIG.EQUIP_NEED.fine });
  });

  it('IR26 b: held, a pair gives its kit bonus to the punch; it never adds damage', () => {
    const s = makeVillage(), p = s.player;
    p.core.inventory = p.core.inventory.filter((i) => !i.equippedIn?.some((x) => x.startsWith('grip:')));
    p.core.skills[SK.unarmed_strike] = { raw: 60, state: 'normal' } as never;
    const bare = effectiveSkill(s, p, SK.unarmed_strike).value;
    p.core.inventory.push({ id: 'mitts', itemId: IT.mail_mittens, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    const m = usableModes(s, p).find((x) => x.itemId === 'mitts')!;
    expect(m.mode.class).toBe('punch'); // 15 damage, +10 hit, as a bare fist
    expect(effectiveSkill(s, p, SK.unarmed_strike, { itemId: 'mitts', modeId: m.mode.id }).value).toBe(bare + CONFIG.EQUIP_FACTOR * CONFIG.EQUIP_NEED.fine);
  });
});
