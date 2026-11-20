// IR25-IR29: gauntlets are an unarmed weapon. One gear class asking Unarmed strike, a pair held in both grips, one pair per
// level; a punch with them is still a punch, and their kit bonus adds to the Unarmed strike roll.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill, usableModes } from '../../src/ruleset/gear';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';

describe('338 gauntlets', () => {

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
