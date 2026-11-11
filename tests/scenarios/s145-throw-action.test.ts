// 145 The throw action: gear classes are tagged melee or ranged; the Throw attack mode row carries the throw's rules for
// every weapon that lists it. Reach = the weapon's own metres + the row's reachBonusM (THROWN_REACH_M) + perks'
// throwReach metres, in links. The roll is combined: the weapon's own skill × 0.75 + the same class's ranged skill × 0.25, each part with
// its own stand-ins; both parts learn.
import { afterEach, describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { blendedSkill, effectiveSkill, ruleset, usableModes } from '../../src/ruleset';
import { getLibrary, resetLibrary } from '../../src/library';
import { reachLinks } from '../../src/ruleset/range';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { AM } from '../../src/library/tableIds';

afterEach(() => resetLibrary());

const withDagger = () => {
  const s = makeVillage();
  s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger, equippedIn: ['hand:left_arm'] });
  s.player.core.inventory.find((i) => i.itemId === IT.round_shield)!.equippedIn = undefined;
  return s;
};
const throwOf = (s: ReturnType<typeof makeVillage>, id = 'dg') => usableModes(s, s.player).find((m) => m.itemId === id && m.mode.id === AM.throw)!.mode;

describe('145 The throw action', () => {
  it('every gear class is tagged by use; weapon classes are melee or ranged', () => {
    const gc = Object.values(getLibrary().gearClasses!);
    for (const c of gc) expect(['melee', 'ranged', 'improvised', 'armor', 'shield']).toContain(c.use);
    for (const c of gc) if (c.skill === SK.melee_light || c.skill === SK.melee_medium || c.skill === SK.melee_heavy) expect(c.use).toBe('melee');
    for (const c of gc) if (c.skill === SK.ranged_light || c.skill === SK.ranged_medium || c.skill === SK.ranged_heavy) expect(c.use).toBe('ranged');
  });

  it('reach: gear keeps its own reach; the Throw row adds THROWN_REACH_M, and perks add throwReach metres', () => {
    const lib = getLibrary();
    const dagger = lib.items[IT.dagger].weapon!.modes.find((m) => m.id === AM.throw)!;
    expect(dagger.reach).toBe(0); // nothing coded into the gear: its own 1 m
    expect(lib.attackModes![AM.throw].reachBonusM).toBe(CONFIG.THROWN_REACH_M);
    const s = withDagger();
    expect(throwOf(s).reach).toBe(reachLinks(dagger.reachM + CONFIG.THROWN_REACH_M));
    s.player.core.inventory.push({ id: 'sp', itemId: IT.spear, equippedIn: ['hand:right_arm'] });
    s.player.core.inventory.find((i) => i.itemId === IT.arming_sword)!.equippedIn = undefined;
    expect(throwOf(s, 'sp').reach).toBe(reachLinks(2.8 + CONFIG.THROWN_REACH_M)); // a spear is 2.8 m long
    getLibrary().perks.far_arm = { id: 'far_arm', name: 'Far Arm', throwReach: 8 }; // metres
    s.player.core.perks.push({ perkId: 'far_arm', source: 'class', gainedTurn: 0 });
    expect(throwOf(s).reach).toBe(reachLinks(dagger.reachM + CONFIG.THROWN_REACH_M + 8));
    expect(usableModes(s, s.player).find((m) => m.itemId === 'dg' && m.mode.id === AM.slash)!.mode.reach).toBe(0); // the slash is untouched
  });

  it('the roll is combined: own skill × 0.75 + same-class ranged × 0.25, each part with its own stand-ins and gear', () => {
    const s = withDagger(), p = s.player;
    const m = throwOf(s);
    expect(m.blend).toEqual([{ skill: SK.melee_light, share: CONFIG.THROW_BLEND.weapon }, { skill: SK.ranged_light, share: CONFIG.THROW_BLEND.ranged }]);
    p.core.skills[SK.melee_light] = { raw: 40, state: 'normal' };
    p.core.skills[SK.ranged_light] = { raw: 20, state: 'normal' };
    const ctx = { itemId: 'dg' };
    const want = 0.75 * effectiveSkill(s, p, SK.melee_light, ctx).value + 0.25 * effectiveSkill(s, p, SK.ranged_light, ctx).value;
    expect(blendedSkill(s, p, m.blend!, ctx).value).toBeCloseTo(want);
    // the dagger's kit bonus is for its own skill only: the ranged part gets none
    expect(effectiveSkill(s, p, SK.ranged_light, ctx).gear).toEqual([]);
    // stand-ins work per part: with no Light weapons, Medium weapons stands in for the melee part alone
    delete p.core.skills[SK.melee_light];
    const b = blendedSkill(s, p, m.blend!, ctx);
    expect(b.parts).toEqual([effectiveSkill(s, p, SK.melee_light, ctx).skill, SK.ranged_light]);
    expect(b.value).toBeCloseTo(0.75 * effectiveSkill(s, p, SK.melee_light, ctx).value + 0.25 * effectiveSkill(s, p, SK.ranged_light, ctx).value);
  });

  it('the roll uses the blend and reports both parts (both learn)', () => {
    const s = withDagger(), p = s.player;
    const m = throwOf(s);
    const r = ruleset.roll({ actorId: p.id, skill: m.skill!, modifiers: [], tierShifts: [], auto: false, itemId: 'dg', blend: m.blend }, s, forcedRng([50]));
    expect(r.parts).toEqual([SK.melee_light, SK.ranged_light].map((k) => effectiveSkill(s, p, k, { itemId: 'dg' }).skill));
    expect(r.margin).toBeCloseTo(50 + CONFIG.SKILL_WEIGHT * blendedSkill(s, p, m.blend!, { itemId: 'dg' }).value - CONFIG.ROLL_NEEDED);
  });
});
