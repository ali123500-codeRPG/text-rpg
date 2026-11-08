// Template rules (Ali, 08/11/2026): anyone with fighting experience is at least level 4, villagers at least level 2,
// and any patrolling template, now and later, has Keen Ear.
import { describe, expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import { getLibrary } from '../../src/library';
import { hasPerk } from '../../src/ruleset/perks';

describe('template rules', () => {
  it('levels: fighters 4 or more, humanoid villagers 2 or more', () => {
    makeVillage();
    const t = getLibrary().templates;
    for (const id of ['guard', 'thief']) expect(t[id].level).toBeGreaterThanOrEqual(4);
    for (const id of ['trader', 'patron']) expect(t[id].level).toBeGreaterThanOrEqual(2);
  });
  it('every template whose role has a routine set with a patrol routine lists Keen Ear', () => {
    makeVillage();
    const lib = getLibrary();
    const patrolRoles = new Set(Object.values(lib.routineSets).filter((r) => r.routines.some((id) => lib.routines[id]?.id === 'patrol' || id === 'patrol')).flatMap((r) => r.tags.role));
    expect(patrolRoles.size).toBeGreaterThan(0);
    for (const t of Object.values(lib.templates)) if (patrolRoles.has(t.id)) expect(t.perks ?? [], t.id).toContain('keen_ear');
  });
  it('a spawned guard has Keen Ear from its template', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === 'guard')!;
    expect(hasPerk(g, 'keen_ear')).toBe(true);
    expect(g.core.perks.find((p) => p.perkId === 'keen_ear')?.source).toBe('template');
    expect(hasPerk(actor(s, 'patron_1'), 'keen_ear')).toBe(false);
  });
});
