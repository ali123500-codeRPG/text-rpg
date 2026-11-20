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

