// The Stacking tab lists every source of a typed roll modifier from MOD_SOURCES: each source names real library rows.
import { describe, expect, it } from 'vitest';
import { MOD_SOURCES } from '../../src/ruleset/modSources';
import { prototypeLibrary } from '../../src/library/data';

describe('modifier sources', () => {
  it('every library entry a source names exists', () => {
    const lib = prototypeLibrary();
    for (const s of MOD_SOURCES) for (const f of s.feeds?.(lib) ?? []) expect((lib[f.table] as Record<string, unknown>)[f.id], `${s.source}: ${f.id}`).toBeDefined();
  });
});

describe('the Stacking tab shows level names, not keys', () => {
  it('BG-76: the morale level row names each level as the morale scale does', async () => {
    const { CONFIG } = await import('../../src/config');
    const { MORALE_LEVELS } = await import('../../src/scales');
    const row = MOD_SOURCES.find((m) => m.source === 'Morale level')!;
    for (const [k, , v] of CONFIG.MORALE_TRACK) if (v) expect(row.value).toContain(MORALE_LEVELS.name(k as never));
  });
});
