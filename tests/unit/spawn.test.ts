import { afterEach, describe, expect, it } from 'vitest';
import { createRng } from '../harness';
import { createPlayer, recommendedBuild, rollUniqueSkills, spawnNpc, validateBuild } from '../../src/library/spawn';
import { getLibrary, npcTemplate, resetLibrary, setLibrary } from '../../src/library';
import { CONFIG, resetConfig } from '../../src/config';

afterEach(() => { resetConfig(); resetLibrary(); });

describe('player creation', () => {
  it('the recommended build passes every rule', () => {
    expect(validateBuild(recommendedBuild())).toEqual([]);
  });
  it('rejects builds that break the rules', () => {
    const b = recommendedBuild();
    expect(validateBuild({ ...b, skills: { ...b.skills, barter: 0 } })).toEqual(['Spend exactly 250 points (240 spent)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, melee_medium: 61, barter: 0, intimidation: 14 } })).toEqual(['melee_medium is above 60']);
    expect(validateBuild({ ...b, skills: { ...b.skills, block: 10, barter: 40 } })).toEqual(['block must be at least 15 (class floor)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, tremor: 10, barter: 0 } })).toEqual(['tremor is not open to the point-buy']);
    expect(validateBuild({ ...b, tagged: ['block', 'dodge'] })).toEqual(['Tag exactly 3 skills (2 tagged)']);
    expect(validateBuild({ ...b, name: ' ' })).toEqual(['Name the character']);
  });
  it('builds the sheet: StartingTotal, tags, starting gear, coin', () => {
    const p = createPlayer(recommendedBuild(), 's1');
    expect(p.progression!.startingTotal).toBe(250 - 50 - 40 - 40);
    expect(p.core.skills.block).toEqual({ raw: 40, state: 'tagged' });
    expect(p.core.inventory.map((i) => [i.itemId, i.equippedIn?.[0], i.qty])).toEqual([
      ['arming_sword', 'hand:right_arm', undefined], ['round_shield', 'hand:left_arm', undefined], ['gambeson', 'armor', undefined], ['coin', undefined, CONFIG.STARTING_COIN], ['bandage', undefined, CONFIG.STARTING_BANDAGES],
    ]);
    expect(p.core.classes).toEqual([{ classId: 'swordsman', state: 'current', level: 1 }]);
    expect(() => createPlayer({ ...recommendedBuild(), tagged: [] }, 's1')).toThrow(/invalid build/);
  });
});

describe('unique generation', () => {
  const bandit = { ...npcTemplate(null, 'guard'), id: 'bandit', generation: 'unique' as const };
  const sum = (s: Record<string, { raw: number }>) => Object.values(s).reduce((n, e) => n + e.raw, 0);

  it('is seeded: minimums plus level x POINTS_PER_LEVEL + bonus, preferred skills tagged', () => {
    const a = rollUniqueSkills(bandit, createRng(5));
    expect(rollUniqueSkills(bandit, createRng(5))).toEqual(a);
    expect(sum(a)).toBe(sum(Object.fromEntries(Object.entries(bandit.minimums).map(([k, v]) => [k, { raw: v }]))) + 2 * 3 + 10);
    expect(Object.entries(a).filter(([, e]) => e.state === 'tagged').map(([k]) => k).sort()).toEqual(['block', 'melee_medium', 'sight']);
    const seeds = new Set([1, 2, 3, 4, 5, 6].map((n) => JSON.stringify(rollUniqueSkills(bandit, createRng(n)))));
    expect(seeds.size).toBeGreaterThan(1); // spending is uneven across seeds
  });
  it('never goes above 100: the rest spills into the tree', () => {
    const t = { ...bandit, minimums: { melee_medium: 98 }, level: 0, bonusPoints: 30, focus: [{ treeId: 'melee', skill: 'melee_medium' }] };
    const s = rollUniqueSkills(t, createRng(1));
    expect(s.melee_medium.raw).toBe(100);
    expect(sum(s)).toBe(128);
  });
  it('spawnNpc rolls a unique once (needs the rng) and saves its perk points; copies stay at minimums', () => {
    const lib = getLibrary();
    lib.templates.bandit = bandit;
    setLibrary(lib);
    const opts = { id: 'b1', zone: 'z', placeId: 'p', bandId: 'x' };
    expect(() => spawnNpc(null, 'bandit', opts)).toThrow(/seeded rng/);
    const b = spawnNpc(null, 'bandit', opts, createRng(5));
    expect(b.core.generation).toBe('unique');
    expect(b.core.skills).toEqual(rollUniqueSkills(bandit, createRng(5)));
    expect(b.progression!.unspentPerkPoints).toBe(1);
    expect(spawnNpc(null, 'guard', opts).core.skills.melee_medium).toEqual({ raw: 40, state: 'normal' });
  });
});

describe('race innate perks and quirks (Ali, 08/11/2026)', () => {
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
