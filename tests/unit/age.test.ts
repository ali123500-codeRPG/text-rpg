// Character age (AG1–AG22): life stages per race, the old-age decline, NPC ages at spawn, creation and the stage line.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { ageKeeps, ageText, advanceAging, bornDayFor, lifeStage, stageName, stageOf } from '../../src/ruleset/age';
import { effectiveSkill } from '../../src/ruleset/gear';
import { createPlayer, recommendedBuild, refreshCopies, spawnNpc, validateBuild } from '../../src/library/spawn';
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
