// The Stacking tab lists every source of a typed roll modifier from MOD_SOURCES. This keeps that list honest:
// each place in src that makes a modifier with a type must have one MOD_SOURCES entry with the same file and type.
// A new modifier source fails here until it is added to src/ruleset/modSources.ts.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOD_SOURCES, MOD_TYPE_NAMES } from '../../src/ruleset/modSources';
import { prototypeLibrary } from '../../src/library/data';

const TYPES = Object.keys(MOD_TYPE_NAMES).join('|');
const MADE = new RegExp(`type: '(${TYPES})'(?: as const)?\\s*[,}]`, 'g');
const SKIP = ['src/ruleset/modSources.ts', 'src/ui/libraryViewer.ts'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n: string) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : n.endsWith('.ts') ? [p] : [];
  });
}
const count = (pairs: string[]) => pairs.reduce<Record<string, number>>((o, k) => ({ ...o, [k]: (o[k] ?? 0) + 1 }), {});

describe('modifier sources', () => {
  it('every place that makes a typed modifier is listed in MOD_SOURCES', () => {
    const made = files('src').filter((f) => !SKIP.includes(f.replace(/\\/g, '/')))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(MADE)].map((m: RegExpMatchArray) => `${f.replace(/\\/g, '/')} ${m[1]}`));
    expect(count(MOD_SOURCES.map((s) => `${s.at} ${s.type}`))).toEqual(count(made));
  });
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
