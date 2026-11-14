// Template rules (NG13, done by the generator): anyone with fighting experience is at least level 4, villagers at least
// level 2, and any patrolling template, now and later, has Keen Ear.
import { TP } from '../../src/library/templateIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import { getLibrary } from '../../src/library';
import { patrols, templateLevel, templatePerks } from '../../src/library/spawn';
import { hasPerk } from '../../src/ruleset/perks';
import { PK } from '../../src/library/perkIds';

describe('template rules', () => {
  it('levels: fighters 4 or more, humanoid villagers 2 or more', () => {
    makeVillage();
    const t = getLibrary().templates;
    for (const id of [TP.guard, TP.thief]) expect(templateLevel(t[id])).toBeGreaterThanOrEqual(4);
    for (const id of [TP.trader, TP.patron]) expect(templateLevel(t[id])).toBeGreaterThanOrEqual(2);
  });
  it('every template a routine set with a patrol routine is for gets Keen Ear (NG13: a generator rule)', () => {
    makeVillage();
    const lib = getLibrary();
    const patrolling = Object.values(lib.templates).filter((t) => patrols(t));
    expect(patrolling.map((t) => t.id)).toContain(TP.guard); // the role tags name the guard by its TP key
    for (const t of patrolling) expect(templatePerks(t), t.id).toContain(PK.keen_ear);
  });
  it('a spawned guard has Keen Ear from its template', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.core.templateId === TP.guard)!;
    expect(hasPerk(g, PK.keen_ear)).toBe(true);
    expect(g.core.perks.find((p) => p.perkId === PK.keen_ear)?.source).toBe('template');
    expect(hasPerk(actor(s, 'patron_1'), PK.keen_ear)).toBe(false);
  });
});
