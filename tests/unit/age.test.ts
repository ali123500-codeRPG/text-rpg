// Character age (AG1–AG27): life stages per race, the old-age decline, NPC ages at spawn, the youngest age per rank and
// talent, no children, creation and the stage line.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { ageFloor, ageKeeps, ageYears, bornDayFor, stageOf, talentMult, talentName } from '../../src/ruleset/age';
import { effectiveSkill } from '../../src/ruleset/gear';
import { rankRow, refreshCopies, spawnNpc } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { fromPages, toPages } from '../../src/save/pages';
import { newReport, repairReferences } from '../../src/save/checks';
import type { Head } from '../../src/types';
import { RC } from '../../src/library/raceIds';
import { SK } from '../../src/library/skillIds';
import { TP } from '../../src/library/templateIds';


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
  it('multiplies them by talent, halving past Prodigy, from the race\'s Youth start', () => {
    expect(['talent_0', 'talent_1', 'talent_2', 'talent_3', 'talent_4', 'talent_5', 'talent_6'].map((k) => talentMult(k as `talent_${number}`))).toEqual([3, 2, 1, 0.75, 0.5, 0.25, 0.125]);
    expect(talentName('talent_6')).toBe('Prodigy++');
    expect(ageFloor(RC.human, rankRow('rank_4').training, 'talent_0')).toBe(49); // a Common human Elite
    expect(ageFloor(RC.human, rankRow('rank_5').training, 'talent_0')).toBe(73); // a Common human Paragon
    expect(ageFloor(RC.elf, rankRow('rank_5').training, 'talent_2')).toBeCloseTo(13 + 20 * 20 / 18); // AB7: an elf is Adult at 20
    expect(ageFloor(RC.dog, rankRow('rank_3').training, 'talent_2')).toBeCloseTo(0.5 + 8 * 2 / 18); // a Veteran dog: under 1.4 years
    expect(ageFloor(RC.slime, 20, 'talent_2')).toBeUndefined();
  });
});

describe('no children', () => {
  it('on load drops an NPC who is still a child (after a library change) and keeps a teen; the player is never dropped', () => {
    const s = makeVillage();
    const [kid, teen] = s.actors.filter((a) => a.kind === 'npc' && a.core.raceId === RC.human);
    kid.core.bornDay = bornDayFor(s, 9);
    teen.core.bornDay = bornDayFor(s, 16);
    const pages = toPages(s);
    repairReferences(pages, getLibrary(), newReport());
    const after = fromPages(s.meta, { libraryVersion: s.libraryVersion } as Head, pages);
    expect(after.actors.some((a) => a.id === kid.id)).toBe(false);
    expect(Math.round(ageYears(after, after.actors.find((a) => a.id === teen.id)!)!)).toBe(16);
    expect(after.player.id).toBe(s.player.id);
  });
});

