// 137 Never Surprised (C1, Earshot 100): hearing range is the noise reach table (Keen Ear adds a link), stealth aside.
import { describe, expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import { hears } from '../../src/perception';
import { getLibrary } from '../../src/library';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { BUILT_PERKS } from '../../src/library/builtPerks';

describe('137 Never Surprised', () => {
  it('is built as the Earshot 100 perk', () => {
    expect(getLibrary().perks[PK.never_surprised]?.ladder).toEqual({ skill: SK.earshot, milestone: 100 });
    expect(BUILT_PERKS.has(PK.never_surprised)).toBe(true);
  });
  it('an attack is heard in the owner zone; Keen Ear hears a quiet one two zones off, never a silent one', () => {
    const s = makeVillage();
    const g = actor(s, 'guard_1');
    g.core.perks = [];
    expect(hears(s, g, g.zone, 'normal')).toBe(true);
    expect(hears(s, g, g.zone, 'faint')).toBe(true);
    expect(hears(s, g, g.zone, 'silent')).toBe(false);
    expect(hears(s, g, 'street_door', 'quiet')).toBe(false); // 2 links: quiet (40 dB) carries 1
    g.core.perks.push({ perkId: PK.keen_ear, source: 'level', gainedTurn: 0 }); // Keen Ear: 10 dB quieter
    expect(hears(s, g, 'street_door', 'quiet')).toBe(true);
    expect(hears(s, g, g.zone, 'silent')).toBe(false);
  });
});
