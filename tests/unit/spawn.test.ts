import { TP } from '../../src/library/templateIds';
import { RC } from '../../src/library/raceIds';
import { afterEach, describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { createPlayer, npcMilestonePerks, patrols, presetPersonality, presetSkills, rankKeyOf, rankName, rankPos, rankRow, rankTraitCount, recommendedBuild, refreshCopies, spawnNpc, templateLevel, templatePerks, templateRank, validateBuild } from '../../src/library/spawn';
import { milestonePerk, trueSkill } from '../../src/ruleset/perks';
import { perkPointsUpTo } from '../../src/ruleset/levels';
import { personalityFrom } from '../../src/ruleset/personality';
import { RO, TH } from '../../src/library/npcLayerIds';
import { PA, VL } from '../../src/library/tableIds';
import { getLibrary, itemDef, npcTemplate, resetLibrary, setLibrary } from '../../src/library';
import { shortBy } from '../../src/ruleset/requirements';
import { CONFIG, resetConfig } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { RANKS } from '../../src/scales';
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
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.earshot]: 0 } })).toEqual(['Spend exactly 100 points (95 spent)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.melee_medium]: 41, [SK.earshot]: 4 } })).toEqual(['Medium weapons is above 40 (tagged)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.dodge]: 31, [SK.earshot]: 0, [SK.eyesight]: 0, [SK.endurance]: 4 } })).toEqual(['Dodge is above 30 (untagged; tagged skills take up to 40)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.tremor]: 10, [SK.earshot]: 0, [SK.eyesight]: 0 } })).toEqual(['Tremor is not open to the point-buy']);
    expect(validateBuild({ ...b, tagged: [SK.melee_medium, SK.parry] })).toEqual(['Tag exactly 3 skills (2 tagged)']);
    expect(validateBuild({ ...b, name: ' ' })).toEqual(['Name the character']);
  });
  it('builds the sheet: StartingTotal, tags, starting gear, coin', () => {
    const p = createPlayer(recommendedBuild(), 's1');
    expect(p.progression!.startingTotal).toBe(100 - 40 - 25 - 15);
    expect(p.core.skills[SK.parry]).toEqual({ raw: 25, state: 'tagged' });
    expect(p.core.inventory.map((i) => [i.itemId, i.equippedIn?.[0], i.qty])).toEqual([
      // the starter kit: per gear class the highest 'starter' item met (Medium Weapons 40: the Common hand axe; no Light Armor: the
      // crude clothes; the recommended build parries, so with Block 0 it gets no shield)
      [IT.crude_clothes, 'armor', undefined], [IT.hand_axe, 'grip:right_arm', undefined], [IT.pack, 'pack', undefined], // CT7: a worn pack
      [IT.coin, undefined, CONFIG.STARTING_COIN], [IT.bandage, undefined, CONFIG.STARTING_BANDAGES],
    ]);
    expect(p.core.classes).toEqual([{ classId: CL.late_bloomer, state: 'current', level: 1 }, { classId: CL.commoner, state: 'unlocked', level: 0 }]); // the first Start; Commoner open from the start
    expect(p.progression!.unspentPerkPoints).toBe(0); // level 1: no perk point yet
    for (const i of p.core.inventory) expect(shortBy(p, itemDef(null, i.itemId))).toBe(0); // EQ13: the build meets its starting gear
    expect(() => createPlayer({ ...recommendedBuild(), tagged: [] }, 's1')).toThrow(/invalid build/);
  });
});

describe('NPC generation by rank, role and theme (NG1–NG9)', () => {
  const bandit = { ...npcTemplate(null, TP.guard), id: 'bandit', classId: undefined, generation: 'rolled' as const, minimums: {} };
  const banded = (t: typeof bandit) => presetSkills(t); // the preset's centre values, no spread

  it('NG2: each banded skill sits at rank anchor × band share; high-band skills are tagged; nothing else rises (NG8)', () => {
    const s = banded(bandit); // Soldier, Town watch, Trained (anchor 50)
    expect([s[SK.melee_medium].raw, s[SK.block].raw]).toEqual([50, 50]);
    expect([s[SK.medium_armor].raw, s[SK.endurance].raw, s[SK.eyesight].raw]).toEqual([40, 40, 40]);
    expect([s[SK.parry].raw, s[SK.earshot].raw]).toEqual([30, 30]); // earshot: a common skill (NG8)
    expect(Object.entries(s).filter(([, e]) => e.state === 'tagged').map(([k]) => k).sort()).toEqual([SK.block, SK.melee_medium].sort());
    expect(s[SK.melee_light]).toBeUndefined(); // no spill into the tree
    expect(s[SK.barter]).toBeUndefined();
  });
  it('NG5 b: the cap is the player\'s, 100 or 125 tagged, up to Paragon; D-314 c: Beyond and up skip it; NG3: ranks go on past Divine', () => {
    for (const rank of ['rank_4', 'rank_5'] as const) {
      const s = banded({ ...bandit, rank });
      expect(s[SK.melee_medium].raw).toBe(Math.min(rankRow(rank).anchor, CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS));
      expect(s[SK.medium_armor].raw).toBe(Math.min(rankRow(rank).anchor * 0.8, CONFIG.SKILL_CAP));
    }
    for (const rank of ['rank_6', 'rank_7', 'rank_transcendent', 'rank_8', 'rank_10'] as const) {
      const s = banded({ ...bandit, rank });
      expect([s[SK.melee_medium].raw, s[SK.medium_armor].raw]).toEqual([rankRow(rank).anchor, Math.round(rankRow(rank).anchor * 0.8)]);
    }
    expect(banded({ ...bandit, rank: 'rank_6' })[SK.melee_medium].raw).toBe(150);
    expect(rankRow('rank_10')).toEqual({ anchor: 600, level: 100, training: 70 });
    expect([rankName('rank_2'), rankName('rank_8'), rankName('rank_10')]).toEqual(['Trained', 'Divine', 'Divine++']);
  });
  it('D-335: Transcendent (300) sits between Mythic and Divine on its own key; saved keys keep their meaning', () => {
    expect([rankPos('rank_7') < rankPos('rank_transcendent'), rankPos('rank_transcendent') < rankPos('rank_8'), rankPos('rank_8') < rankPos('rank_9')]).toEqual([true, true, true]);
    expect([rankName('rank_transcendent'), rankRow('rank_transcendent').anchor]).toEqual(['Transcendent', 300]);
    expect([rankName('rank_9'), rankRow('rank_9').anchor]).toEqual(['Divine+', 500]); // a key past Divine still means one step past it
    expect([rankKeyOf('Transcendent'), rankKeyOf('rank_transcendent'), rankKeyOf('Divine+'), rankKeyOf('rank_9')]).toEqual(['rank_transcendent', 'rank_transcendent', 'rank_9', 'rank_9']);
    for (const k of RANKS.keys) { expect(CONFIG.RANK_ROWS[k], k).toBeDefined(); expect(CONFIG.RANK_TRAITS[k], k).toBeDefined(); }
    const anchors = RANKS.keys.map((k) => rankRow(k).anchor);
    expect(anchors).toEqual([...anchors].sort((a, b) => a - b));
  });
  it('NG9: each copy moves by up to ± COPY_SPREAD, seeded by its ID; minimums and class floors still hold', () => {
    const a = presetSkills(bandit, createRng(5));
    expect(presetSkills(bandit, createRng(5))).toEqual(a);
    expect(JSON.stringify(presetSkills(bandit, createRng(6)))).not.toBe(JSON.stringify(a));
    const centre = banded(bandit);
    for (const [k, e] of Object.entries(a)) if (k !== SK.resolve) expect(Math.abs(e.raw - centre[k].raw)).toBeLessThanOrEqual(Math.ceil(centre[k].raw * CONFIG.COPY_SPREAD));
    const guard = npcTemplate(null, TP.guard), g = presetSkills(guard, createRng(9));
    for (const [k, v] of Object.entries(guard.minimums)) expect(g[k].raw).toBeGreaterThanOrEqual(v);
  });
  it('NG7: level comes from the rank; spawnNpc rolls a rolled NPC once, and copies differ by ID but rebuild the same', () => {
    const lib = getLibrary();
    lib.templates.bandit = bandit;
    setLibrary(lib);
    const opts = { id: 'b1', zone: 'z', placeId: 'p', bandId: 'x' };
    expect(() => spawnNpc(null, 'bandit', opts)).toThrow(/seeded rng/);
    const b = spawnNpc(null, 'bandit', opts, createRng(5));
    expect(b.core.skills).toEqual(presetSkills(bandit, createRng(5)));
    expect(templateLevel(bandit)).toBe(4);
    const spent = b.core.perks.filter((p) => p.source === 'level').length; // NG11: its level's 2 points go on milestone perks
    expect(spent).toBeGreaterThan(0);
    expect(b.progression!.unspentPerkPoints).toBe(2 - spent);
    const g1 = spawnNpc(null, TP.guard, opts), g2 = spawnNpc(null, TP.guard, { ...opts, id: 'b2' });
    expect(JSON.stringify(g1.core.skills)).not.toBe(JSON.stringify(g2.core.skills));
    expect(spawnNpc(null, TP.guard, opts).core.skills).toEqual(g1.core.skills);
    expect(g1.core.classes[0].level).toBe(4);
  });
  it('NG2: one lever over every NPC (NPC_BAND_MULT) reaches existing copies: refreshCopies rebuilds them', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    const before = g.core.skills[SK.melee_medium].raw;
    (CONFIG as { NPC_BAND_MULT: number }).NPC_BAND_MULT = 1.5;
    g.core.perks = [];
    refreshCopies(s);
    expect(g.core.skills[SK.melee_medium].raw).toBeGreaterThan(before);
    expect(g.core.perks.map((p) => p.perkId)).toContain(PK.keen_ear);
  });
  it('NG1, NG21: every preset names a known role, theme and rank; every role and theme is used or available', () => {
    const lib = getLibrary();
    for (const t of Object.values(lib.templates).filter((x) => x.generation !== 'unique')) {
      expect(lib.npcRoles?.[t.roleId!], t.id).toBeDefined();
      expect(lib.themes?.[t.themeId!], t.id).toBeDefined();
      expect(t.rank, t.id).toMatch(/^rank_\d+$/);
      expect(t.level, t.id).toBeUndefined(); // NG7: presets never set a level
    }
    expect(Object.keys(lib.npcRoles ?? {})).toHaveLength(9);
    expect(Object.keys(lib.themes ?? {})).toHaveLength(4);
  });
});

describe('NPC perks, traits, rules and personality (NG11–NG14)', () => {
  afterEach(() => resetLibrary());
  const guard = () => npcTemplate(null, TP.guard);
  const opts = { id: 'g1', zone: 'z', placeId: 'p', bandId: 'x' };

  it('NG13: rank floors by role kind (combat Trained, civilian Novice, beasts none); a patrolling preset gets Keen Ear from the rule', () => {
    expect(templateRank({ ...guard(), rank: 'rank_0' })).toBe(CONFIG.RANK_FLOOR.combat);
    expect(templateLevel({ ...guard(), rank: 'rank_0' })).toBe(rankRow('rank_2').level);
    expect(templateRank({ ...npcTemplate(null, TP.trader), rank: 'rank_0' })).toBe(CONFIG.RANK_FLOOR.civilian);
    expect(templateRank(npcTemplate(null, TP.slime))).toBe('rank_0');
    expect(templateRank({ ...guard(), rank: 'rank_4' })).toBe('rank_4'); // a floor never lowers
    expect(guard().perks ?? []).not.toContain(PK.keen_ear); // no longer typed into the preset
    expect(patrols(guard())).toBe(true);
    expect(patrols(npcTemplate(null, TP.trader))).toBe(false);
    expect(templatePerks(guard())).toContain(PK.keen_ear);
  });

  it('NG11: a copy spends its level\'s perk points on milestone perks by the player\'s rules, High-band skills first', () => {
    const g = spawnNpc(null, TP.guard, opts);
    const level = g.core.perks.filter((p) => p.source === 'level').map((p) => getLibrary().perks[p.perkId]);
    expect(level.length).toBe(perkPointsUpTo(templateLevel(guard())));
    for (const d of level) expect(trueSkill(g, d.ladder!.skill)).toBeGreaterThanOrEqual(d.ladder!.milestone);
    expect([SK.melee_medium, SK.block]).toContain(level[0].ladder!.skill); // a High-band skill (Soldier) first
    const again = structuredClone(g);
    again.core.perks = again.core.perks.filter((p) => p.source !== 'level');
    expect(npcMilestonePerks(again, guard(), 0, 0)).toEqual([]); // no points, no perks
    expect(milestonePerk(SK.melee_medium, 20)).toBeDefined();
  });

  it('NG12: ranks draw traits from the theme and role pools, seeded by the actor; Veteran is the first to draw', () => {
    expect(RANKS.keys.map((k) => rankTraitCount(k))).toEqual(RANKS.keys.map((k) => CONFIG.RANK_TRAITS[k]));
    expect(rankTraitCount('rank_10')).toBe(CONFIG.RANK_TRAITS.rank_8 + 2 * CONFIG.RANK_TRAITS_BEYOND);
    expect(templatePerks(guard(), 'g1')).toEqual(templatePerks(guard())); // Trained: none drawn
    const vet = { ...guard(), rank: 'rank_3' as const };
    const pool = [...(getLibrary().npcRoles![RO.soldier].traits ?? []), ...(getLibrary().themes![TH.town_watch].traits ?? [])];
    const drawn = templatePerks(vet, 'g1').filter((id) => id !== PK.keen_ear);
    expect(drawn).toHaveLength(1);
    expect(pool).toContain(drawn[0]);
    expect(templatePerks(vet, 'g1')).toEqual(templatePerks(vet, 'g1')); // the same actor draws the same
  });

  it('NG14: personality from the theme lean, the role lean and the preset pins, then a seeded spread; the Weaver goes on top', () => {
    expect(presetPersonality(guard())).toEqual({ nerve: 0, traits: { [PA.discipline]: 40 }, values: [VL.duty] });
    expect(presetPersonality(npcTemplate(null, TP.trader))).toEqual({ nerve: -40, traits: { [PA.sociability]: 20 }, values: [VL.wealth, VL.family] });
    expect(presetPersonality(npcTemplate(null, TP.patron)).values).toEqual([VL.pleasure, VL.family]); // the preset's own value first
    const a = presetPersonality(guard(), 'g1'), b = presetPersonality(guard(), 'g2');
    expect(a).not.toEqual(b);
    expect(presetPersonality(guard(), 'g1')).toEqual(a);
    for (const k of Object.values(PA)) expect(Math.abs((a.traits[k] ?? 0) - (presetPersonality(guard()).traits[k] ?? 0))).toBeLessThanOrEqual(CONFIG.PERSONALITY_SPREAD);
    expect(a.nerve).toBe(0); // Nerve is not spread
    expect(presetPersonality(npcTemplate(null, TP.slime), 's1')).toEqual({ nerve: 0, traits: {}, values: [] }); // a beast has none
    expect(spawnNpc(null, TP.guard, opts).core.personality).toEqual(a);
    expect(personalityFrom(a, { nerve: 'daring' }).nerve).toBe(CONFIG.NERVE_LINE_POINTS);
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
      races: { ...lib.races, [RC.human]: { ...lib.races![RC.human], innatePerks: ['keen_nose', 'tall'], innateQuirks: ['sun_shy'] } } });
    const want = ['keen_nose', 'tall', 'sun_shy'].map((perkId) => ({ perkId, source: 'race', gainedTurn: 0 }));
    expect(createPlayer(recommendedBuild(), 's1').core.perks.filter((p) => p.source === 'race')).toEqual(want);
    expect(spawnNpc(null, TP.patron, { id: 'p1', zone: 'tav_common', placeId: 'tavern', bandId: 'tavern_folk' }).core.perks.filter((p) => p.source === 'race')).toEqual(want);
  });
});
