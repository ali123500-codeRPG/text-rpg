// Template rules: anyone with fighting experience is at least level 4, villagers at least level 2,
// and any patrolling template, now and later, has Keen Ear.
import { TP } from '../../src/library/templateIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import { getLibrary } from '../../src/library';
import { hasPerk } from '../../src/ruleset/perks';
import { PK } from '../../src/library/perkIds';

describe('template rules', () => {
  it('levels: fighters 4 or more, humanoid villagers 2 or more', () => {
    makeVillage();
    const t = getLibrary().templates;
    for (const id of [TP.guard, TP.thief]) expect(t[id].level).toBeGreaterThanOrEqual(4);
    for (const id of [TP.trader, TP.patron]) expect(t[id].level).toBeGreaterThanOrEqual(2);
  });
  it('every template whose role has a routine set with a patrol routine lists Keen Ear', () => {
    makeVillage();
    const lib = getLibrary();
    const patrolRoles = new Set(Object.values(lib.routineSets).filter((r) => r.routines.some((id) => lib.routines[id]?.id === 'patrol' || id === 'patrol')).flatMap((r) => r.tags.role));
    expect(patrolRoles.size).toBeGreaterThan(0);
    for (const t of Object.values(lib.templates)) if (patrolRoles.has(t.id)) expect(t.perks ?? [], t.id).toContain(PK.keen_ear);
  });
  it('a spawned guard has Keen Ear from its template', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    expect(hasPerk(g, PK.keen_ear)).toBe(true);
    expect(g.core.perks.find((p) => p.perkId === PK.keen_ear)?.source).toBe('template');
    expect(hasPerk(actor(s, 'patron_1'), PK.keen_ear)).toBe(false);
  });
});
