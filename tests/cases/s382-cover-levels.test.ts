// CV1-CV8: five cover levels by the share of a standing person hidden; a roll modifier of COVER_HALVING_MOD for each
// halving of what shows; a ranged attack takes it as a minus, a hide-tagged roll as the same plus.
import { describe, expect, it } from 'vitest';
import { COVER } from '../../src/scales';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { LC } from '../../src/library/tableIds';
import { coverMod } from '../../src/ruleset/gear';
import { MOD_SOURCES } from '../../src/ruleset/modSources';

describe('382 cover levels (CV1-CV8)', () => {
  it('five levels, each hiding more of a person; a person reads 0, 4, 10, 20, 30', () => {
    const hidden = COVER.keys.map((k) => CONFIG.COVER_HIDDEN[k]);
    expect(hidden.map((h) => coverMod(1 - h))).toEqual([0, 4, 10, 20, 30]);
    expect(coverMod(1)).toBe(0);
  });

  it('CV2, PZ6: a heath gives light cover (clutter comes from the land, never a title\'s kind)', () => {
    const lib = getLibrary();
    expect(lib.landCovers![LC.heath].cover).toBe('light');
    for (const k of Object.values(lib.zoneKinds!)) expect('cover' in k, k.name).toBe(false);
  });

  it('the roll modifiers list shows the cover row for a person', () => {
    const row = MOD_SOURCES.find((r) => r.source === 'Cover')!;
    expect(row.type).toBe('situational');
    expect(row.value).toBe('none 0 · light +4 · some +10 · heavy +20 · dense +30');
    expect(MOD_SOURCES.find((r) => r.source === 'Cover (shot)')!.value).toBe('none 0 · light −4 · some −10 · heavy −20 · dense −30');
  });
});
