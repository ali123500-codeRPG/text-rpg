// Character age (AG1–AG27): life stages per race, the old-age decline, NPC ages at spawn, the youngest age per rank and
// talent, no children, creation and the stage line.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { bannedLines } from '../harness/guard';
import { intent, wholeTurn } from '../harness/turn';
import { FIXED } from '../../src/agents/prompts';
import { ageFloor, ageKeeps, ageText, ageYears, advanceAging, bornDayFor, lifeStage, stageName, stageOf, stageReaches, talentMult, talentName, youngestAge } from '../../src/ruleset/age';
import { effectiveSkill } from '../../src/ruleset/gear';
import { createPlayer, presetAgeFloor, presetTalent, rankRow, recommendedBuild, refreshCopies, spawnNpc, validateBuild } from '../../src/library/spawn';
import { getLibrary, npcTemplate } from '../../src/library';
import { fromPages, toPages } from '../../src/save/pages';
import { newReport, repairReferences } from '../../src/save/checks';
import type { Head } from '../../src/types';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { RC } from '../../src/library/raceIds';
import { SK } from '../../src/library/skillIds';
import { TP } from '../../src/library/templateIds';
import { CONFIG } from '../../src/config';
import { DAY_MINUTES } from '../../src/time';

const word = (race: string, y: number) => stageName(lifeStage(race, y)!);

describe('life stages (AG3–AG7)', () => {
  it('reads each race its own row, and past Ancient adds a + per step', () => {
    expect([12, 13, 18, 40, 60, 80, 100].map((y) => word(RC.human, y))).toEqual(['Child', 'Youth', 'Adult', 'Middle-aged', 'Old', 'Venerable', 'Ancient']);
    expect([120, 140, 200, 400].map((y) => word(RC.human, y))).toEqual(['Ancient+', 'Ancient++', 'Ancient +5', 'Ancient +15']);
    expect(word(RC.elf, 449)).toBe('Venerable');
    expect(word(RC.elf, 450)).toBe('Ancient');
    expect(word(RC.dragon, 500)).toBe('Ancient');
    expect(lifeStage(RC.slime, 10)).toBeUndefined();
  });
});

describe('old-age decline (AG17–AG20)', () => {
  it('halves what a body keeps every Old-to-Ancient gap past Old, on body skills and senses only', () => {
    const s = makeVillage(), p = s.player;
    p.core.skills[SK.melee_medium] = { raw: 100, state: 'normal' };
    p.core.skills[SK.persuasion] = { raw: 100, state: 'normal' };
    const at = (years: number) => { p.core.bornDay = bornDayFor(s, years); return ageKeeps(s, p); };
    expect(at(40)).toBe(1);
    expect(at(60)).toBeCloseTo(1);
    expect(at(70)).toBeCloseTo(0.5 ** 0.25);
    expect(at(100)).toBeCloseTo(0.5);
    expect(at(122)).toBeGreaterThan(0.3); // never reaches zero
    p.core.bornDay = bornDayFor(s, 100);
    const young = { ...p, core: { ...p.core, bornDay: bornDayFor(s, 30) } };
    expect(effectiveSkill(s, p, SK.melee_medium).value).toBeCloseTo(effectiveSkill(s, young, SK.melee_medium).value / 2);
    expect(effectiveSkill(s, p, SK.persuasion).value).toBeCloseTo(effectiveSkill(s, young, SK.persuasion).value); // speech never declines
  });
});

describe('NPC ages (AG13, AG14)', () => {
  it('rolls a birth day once at spawn, seeded by the actor, and keeps it on load', () => {
    const s = makeVillage();
    const a = spawnNpc(s, TP.guard, { id: 'npc_g', zone: 'z', placeId: 'p', bandId: 'b' });
    const b = spawnNpc(s, TP.guard, { id: 'npc_g', zone: 'z', placeId: 'p', bandId: 'b' });
    expect(a.core.bornDay).toBeDefined();
    expect(b.core.bornDay).toBe(a.core.bornDay);
    expect(['Adult', 'Middle-aged']).toContain(stageOf(s, a));
    expect(spawnNpc(s, TP.slime, { id: 'npc_s', zone: 'z', placeId: 'p', bandId: 'b' }).core.bornDay).toBeUndefined();
    expect(stageOf(s, spawnNpc(s, TP.guard, { id: 'npc_o', zone: 'z', placeId: 'p', bandId: 'b', ageStage: 'stage_4' }))).toBe('Old');
    s.actors.push(a);
    const born = a.core.bornDay;
    refreshCopies(s);
    expect(a.core.bornDay).toBe(born);
  });
});

describe('youngest age per rank (AG12, AG21–AG25)', () => {
  it('reads training years from the rank rows, the same for every race, +10 a step past Paragon', () => {
    expect(['rank_0', 'rank_1', 'rank_2', 'rank_3', 'rank_4', 'rank_5', 'rank_6', 'rank_8', 'rank_9'].map((r) => rankRow(r as `rank_${number}`).training)).toEqual([0, 1, 4, 8, 12, 20, 30, 50, 60]);
  });
  it('multiplies them by talent, halving past Prodigy, from the race\'s Youth start', () => {
    expect(['talent_0', 'talent_1', 'talent_2', 'talent_3', 'talent_4', 'talent_5', 'talent_6'].map((k) => talentMult(k as `talent_${number}`))).toEqual([3, 2, 1, 0.75, 0.5, 0.25, 0.125]);
    expect(talentName('talent_6')).toBe('Prodigy++');
    expect(ageFloor(RC.human, rankRow('rank_4').training, 'talent_0')).toBe(49); // a Common human Elite
    expect(ageFloor(RC.human, rankRow('rank_5').training, 'talent_0')).toBe(73); // a Common human Paragon
    expect(ageFloor(RC.elf, rankRow('rank_5').training, 'talent_2')).toBe(33);
    expect(ageFloor(RC.slime, 20, 'talent_2')).toBeUndefined();
  });
  it('takes the Weaver\'s talent, then the preset\'s, then its theme\'s, then Able', () => {
    const g = npcTemplate(null, TP.guard);
    expect(presetTalent(g)).toBe(CONFIG.NPC_TALENT_DEFAULT);
    expect(presetTalent({ ...g, talent: 'talent_3' })).toBe('talent_3');
    expect(presetTalent({ ...g, talent: 'talent_3' }, 'talent_0')).toBe('talent_0');
    expect(presetAgeFloor(g, 'talent_2')).toBe(17); // a Trained human: 13 + 4
  });
  it('never spawns an NPC under its floor, and saves the talent that set it', () => {
    const s = makeVillage();
    for (let i = 0; i < 30; i++) {
      const a = spawnNpc(s, TP.guard, { id: `npc_y${i}`, zone: 'z', placeId: 'p', bandId: 'b', ageStage: 'stage_1' });
      expect(ageYears(s, a)).toBeGreaterThanOrEqual(17);
      expect(stageOf(s, a)).toBe('Youth');
      expect(a.core.talent).toBe('talent_2');
      const c = spawnNpc(s, TP.guard, { id: `npc_c${i}`, zone: 'z', placeId: 'p', bandId: 'b', ageStage: 'stage_1', talent: 'talent_0' });
      expect(ageYears(s, c)).toBeGreaterThanOrEqual(25); // Youth is wholly under a Common guard's 25: it rolls in Adult instead
      expect(stageOf(s, c)).toBe('Adult');
    }
  });
  it('refuses a Weaver stage wholly under the floor, and a talent off the scale', () => {
    const s = toStoryStart(makeVillage());
    const plan = (age: string, talent?: string) => {
      const p = villageStagePlan();
      const g = p.cast.find((c) => c.template === TP.guard)!;
      Object.assign(g, { age, ...(talent ? { talent } : {}) });
      return validateStagePlan(s, p, { tier: 'success', kind: 'scenario', placeId: 'tavern' }).map((e) => e.code);
    };
    expect(plan('Youth')).not.toContain('bad_age');
    expect(plan('Youth', 'Common')).toContain('bad_age');
    expect(plan('Adult', 'Common')).not.toContain('bad_age');
    expect(plan('Adult', 'Genius')).toContain('bad_talent');
    expect(stageReaches(RC.human, 'stage_6', 500)).toBe(true); // Ancient never runs out
  });
});

describe('no children', () => {
  it('puts no one under the race\'s Youth start, whatever the rank, talent or stage', () => {
    expect(youngestAge(RC.human)).toBe(13);
    expect(ageFloor(RC.human, 0, 'talent_4')).toBe(13); // Untrained
    expect(ageFloor(RC.human, rankRow('rank_1').training, 'talent_2')).toBe(14);
    const s = makeVillage();
    for (let i = 0; i < 20; i++) expect(stageOf(s, spawnNpc(s, TP.patron, { id: `npc_k${i}`, zone: 'z', placeId: 'p', bandId: 'b', ageStage: 'stage_0' }))).not.toBe('Child');
    expect(Object.values(getLibrary().templates).some((t) => t.label.includes('child'))).toBe(false);
  });
  it('has no child preset, role or tension left in the code', () => {
    expect(bannedLines(/TP\.child|RO\.child|TN\.old_head|kind: 'child'|ageStage: 'stage_0'/)).toEqual([]);
  });
  it('tells every agent the world has no children, and offers the Weaver no Child stage', async () => {
    const t = wholeTurn();
    await t.turn(intent());
    expect(t.claude.callsFor('narrator')[0].input[0].content).toMatch(/no children in this world/);
    expect(FIXED.weaver).toMatch(/"age"\?:"Youth"\|/);
  });
  it('refuses a Weaver Child for any preset', () => {
    const s = toStoryStart(makeVillage());
    const p = villageStagePlan();
    for (const c of p.cast) if (c.template) c.age = 'Child';
    const bad = validateStagePlan(s, p, { tier: 'success', kind: 'scenario', placeId: 'tavern' }).filter((e) => e.code === 'bad_age');
    expect(bad.map((e) => e.castKey).sort()).toEqual(p.cast.map((c) => c.key).sort());
    expect(bad.find((e) => e.castKey === 'guard_1')?.message).toMatch(/no children/);
  });
  it('on load drops an NPC who is still a child, keeps a teen, and ages a child player up to 13', () => {
    const s = makeVillage();
    const [kid, teen] = s.actors.filter((a) => a.kind === 'npc' && a.core.raceId === RC.human);
    kid.core.bornDay = bornDayFor(s, 9);
    teen.core.bornDay = bornDayFor(s, 16);
    s.player.core.bornDay = bornDayFor(s, 10);
    const pages = toPages(s);
    repairReferences(pages, getLibrary(), newReport());
    const after = fromPages(s.meta, { libraryVersion: s.libraryVersion } as Head, pages);
    expect(after.actors.some((a) => a.id === kid.id)).toBe(false);
    expect(Math.round(ageYears(after, after.actors.find((a) => a.id === teen.id)!)!)).toBe(16);
    expect(Math.round(ageYears(after, after.player)!)).toBe(13);
  });
});

describe('creation age (AG15)', () => {
  const base = () => ({ ...recommendedBuild(), name: 'Aldric' });
  it('defaults to 20 and allows Youth up to Venerable', () => {
    const s = makeVillage();
    expect(ageText(s, createPlayer(base(), 's'))).toBe(`Age ${CONFIG.CREATION_AGE_DEFAULT} · Adult`);
    expect(validateBuild({ ...base(), age: 13 })).toEqual([]);
    expect(validateBuild({ ...base(), age: 12 }).join()).toMatch(/Age/);
    expect(validateBuild({ ...base(), age: 81 }).join()).toMatch(/Age/);
  });
});

describe('the stage line (AG16)', () => {
  it('logs the player reaching a new life stage as time passes', () => {
    const s = makeVillage(), p = s.player;
    p.core.bornDay = bornDayFor(s, 40) + 1; // a day short of 40
    const seen: unknown[] = [];
    advanceAging(s, 2 * DAY_MINUTES, (code, d) => seen.push({ code, ...d }));
    expect(seen).toEqual([expect.objectContaining({ code: 'stage_changed', stage: 'Middle-aged', years: 40 })]);
  });
});
