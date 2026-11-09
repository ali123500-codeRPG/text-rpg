import { TR } from '../../src/library/treeIds';
import { afterEach, describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { createPlayer, recommendedBuild, refreshCopies, rollUniqueSkills, spawnNpc, validateBuild } from '../../src/library/spawn';
import { getLibrary, itemDef, npcTemplate, resetLibrary, setLibrary } from '../../src/library';
import { shortBy } from '../../src/ruleset/requirements';
import { CONFIG, resetConfig } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

afterEach(() => { resetConfig(); resetLibrary(); });

describe('player creation', () => {
  it('the recommended build passes every rule', () => {
    expect(validateBuild(recommendedBuild())).toEqual([]);
  });
  it('rejects builds that break the rules', () => {
    const b = recommendedBuild();
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.earshot]: 20 } })).toEqual(['Spend exactly 250 points (240 spent)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.melee_medium]: 61, [SK.earshot]: 19 } })).toEqual(['Medium weapons is above 60']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.block]: 35, [SK.earshot]: 35 } })).toEqual(['Block must be at least 40 (class floor)']); // floors 40/40
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.tremor]: 10, [SK.earshot]: 20 } })).toEqual(['Tremor is not open to the point-buy']);
    expect(validateBuild({ ...b, tagged: [SK.block, SK.dodge] })).toEqual(['Tag exactly 3 skills (2 tagged)']);
    expect(validateBuild({ ...b, name: ' ' })).toEqual(['Name the character']);
  });
  it('builds the sheet: StartingTotal, tags, starting gear, coin', () => {
    const p = createPlayer(recommendedBuild(), 's1');
    expect(p.progression!.startingTotal).toBe(250 - 50 - 40 - 50);
    expect(p.core.skills[SK.block]).toEqual({ raw: 40, state: 'tagged' });
    expect(p.core.inventory.map((i) => [i.itemId, i.equippedIn?.[0], i.qty])).toEqual([
      // the starter kit: every 'starter' item the build meets; the spear is met too and is carried
      [IT.arming_sword, 'hand:right_arm', undefined], [IT.spear, undefined, undefined], [IT.crude_clothes, undefined, undefined], [IT.gambeson, 'armor', undefined], [IT.round_shield, 'hand:left_arm', undefined],
      [IT.coin, undefined, CONFIG.STARTING_COIN], [IT.bandage, undefined, CONFIG.STARTING_BANDAGES],
    ]);
    expect(p.core.classes).toEqual([{ classId: CL.swordsman, state: 'current', level: 4 }]); // EQ13: the player starts at level 4
    expect(p.progression!.unspentPerkPoints).toBe(2); // the perk points of levels 2 and 4
    for (const i of p.core.inventory) expect(shortBy(p, itemDef(null, i.itemId))).toBe(0); // EQ13: the build meets its starting gear
    expect(() => createPlayer({ ...recommendedBuild(), tagged: [] }, 's1')).toThrow(/invalid build/);
  });
});

describe('unique generation', () => {
  const bandit = { ...npcTemplate(null, 'guard'), id: 'bandit', generation: 'unique' as const };
  const sum = (s: Record<string, { raw: number }>) => Object.values(s).reduce((n, e) => n + e.raw, 0);

  it('is seeded: minimums plus level x POINTS_PER_LEVEL + bonus, preferred skills tagged', () => {
    const a = rollUniqueSkills(bandit, createRng(5));
    expect(rollUniqueSkills(bandit, createRng(5))).toEqual(a);
    expect(sum(a)).toBe(sum(Object.fromEntries(Object.entries(bandit.minimums).map(([k, v]) => [k, { raw: v }]))) + bandit.level * CONFIG.POINTS_PER_LEVEL + bandit.bonusPoints);
    expect(Object.entries(a).filter(([, e]) => e.state === 'tagged').map(([k]) => k).sort()).toEqual([SK.block, SK.melee_medium, SK.eyesight].sort());
    const seeds = new Set([1, 2, 3, 4, 5, 6].map((n) => JSON.stringify(rollUniqueSkills(bandit, createRng(n)))));
    expect(seeds.size).toBeGreaterThan(1); // spending is uneven across seeds
  });
  it('never goes above 100: the rest spills into the tree', () => {
    const t = { ...bandit, minimums: { [SK.melee_medium]: 98 }, level: 0, bonusPoints: 30, focus: [{ treeId: TR.melee, skill: SK.melee_medium }] };
    const s = rollUniqueSkills(t, createRng(1));
    expect(s[SK.melee_medium].raw).toBe(100);
    expect(sum(s)).toBe(128);
  });
  it('spawnNpc rolls a unique once (needs the rng) and saves its perk points; copies get fixed level points', () => {
    const lib = getLibrary();
    lib.templates.bandit = bandit;
    setLibrary(lib);
    const opts = { id: 'b1', zone: 'z', placeId: 'p', bandId: 'x' };
    expect(() => spawnNpc(null, 'bandit', opts)).toThrow(/seeded rng/);
    const b = spawnNpc(null, 'bandit', opts, createRng(5));
    expect(b.core.generation).toBe('unique');
    expect(b.core.skills).toEqual(rollUniqueSkills(bandit, createRng(5)));
    expect(b.progression!.unspentPerkPoints).toBe(Math.floor(bandit.level / 2));
    // Q3: copies get level points too, with a fixed per-template seed, so every guard is alike
    const g1 = spawnNpc(null, 'guard', opts), g2 = spawnNpc(null, 'guard', { ...opts, id: 'b2' });
    expect(g1.core.skills).toEqual(g2.core.skills);
    const guard = npcTemplate(null, 'guard');
    expect(sum(g1.core.skills)).toBe(sum(Object.fromEntries(Object.entries(guard.minimums).map(([k, v]) => [k, { raw: v }]))) + guard.level * CONFIG.POINTS_PER_LEVEL + guard.bonusPoints);
  });
  it('the level lever reaches existing copies: refreshCopies rebuilds them from the current CONFIG', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === 'guard')!;
    const before = sum(g.core.skills);
    const keep = CONFIG.POINTS_PER_LEVEL;
    try {
      (CONFIG as { POINTS_PER_LEVEL: number }).POINTS_PER_LEVEL = keep + 5;
      g.core.perks = [];
      refreshCopies(s);
      expect(sum(g.core.skills)).toBe(before + 5 * npcTemplate(null, 'guard').level);
      expect(g.core.perks.map((p) => p.perkId)).toContain(PK.keen_ear);
    } finally { (CONFIG as { POINTS_PER_LEVEL: number }).POINTS_PER_LEVEL = keep; }
  });
});

describe('race innate perks and quirks', () => {
  it('every listed innate perk exists and is not a quirk; every innate quirk is one', () => {
    const lib = getLibrary();
    for (const r of Object.values(lib.races ?? {})) {
      for (const id of r.innatePerks ?? []) expect(lib.perks[id]?.quirk, `${r.id} perk ${id}`).toBeFalsy();
      for (const id of r.innatePerks ?? []) expect(lib.perks[id], `${r.id} perk ${id}`).toBeDefined();
      for (const id of r.innateQuirks ?? []) expect(lib.perks[id]?.quirk, `${r.id} quirk ${id}`).toBe(true);
    }
  });
  it('NPCs and the player are born with their race\'s lists, as race perks', () => {
    const lib = getLibrary();
    const perk = { id: 'keen_nose', name: 'Keen Nose', quirk: false }, perk2 = { id: 'tall', name: 'Tall' }, quirk = { id: 'sun_shy', name: 'Sun Shy', quirk: true };
    setLibrary({ ...lib, perks: { ...lib.perks, keen_nose: perk, tall: perk2, sun_shy: quirk } as typeof lib.perks,
      races: { ...lib.races, human: { ...lib.races!.human, innatePerks: ['keen_nose', 'tall'], innateQuirks: ['sun_shy'] } } });
    const want = ['keen_nose', 'tall', 'sun_shy'].map((perkId) => ({ perkId, source: 'race', gainedTurn: 0 }));
    expect(createPlayer(recommendedBuild(), 's1').core.perks).toEqual(want);
    expect(spawnNpc(null, 'patron', { id: 'p1', zone: 'tav_common', placeId: 'tavern', bandId: 'tavern_folk' }).core.perks).toEqual(want);
  });
});
