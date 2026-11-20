// Template rules (NG13, done by the generator): anyone with fighting experience is at least level 4, villagers at least
// level 2, and any patrolling template, now and later, has Keen Ear.
import { TP } from '../../src/library/templateIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { templateLevel } from '../../src/library/spawn';

describe('template rules', () => {
  it('levels: fighters 4 or more, humanoid villagers 2 or more', () => {
    makeVillage();
    const t = getLibrary().templates;
    for (const id of [TP.guard, TP.thief]) expect(templateLevel(t[id])).toBeGreaterThanOrEqual(4);
    for (const id of [TP.trader, TP.patron]) expect(templateLevel(t[id])).toBeGreaterThanOrEqual(2);
  });
});
