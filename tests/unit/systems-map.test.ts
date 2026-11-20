// docs/systems.md places every source file in a game system, with its spec sections and history; npm run test:near
// (scripts/test-near.ts) picks the tests nearest a change from it. A new file fails here until it is placed.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sections } from '../../scripts/spec';
import { near, pick, systemFiles } from '../../scripts/test-near';

const map = readFileSync('docs/systems.md', 'utf8');
const systems = systemFiles(map);
const listed = new Set([...systems.values()].flat());

describe('systems map', () => {
  it('lists every source file under at least one system, and only files that exist', () => {
    const src = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .map((f: string) => join('src', f).split('\\').join('/'))
      .filter((f: string) => /\.(ts|css)$/.test(f) && !f.startsWith('src/ui/assets/'));
    expect(src.filter((f: string) => !listed.has(f)), 'add these to a system in docs/systems.md').toEqual([]);
    expect([...listed].filter((f: string) => !existsSync(f)), 'gone: remove from docs/systems.md').toEqual([]);
    expect(systems.size).toBe((map.match(/^## [a-z-]+:/gm) ?? []).length);
  });

  it('names only spec headings and history files that exist', () => {
    const titles = sections(readFileSync('docs/build-spec.md', 'utf8').split('\n')).map((s) => s.title.toLowerCase());
    const spec = [...map.matchAll(/^- Spec: ((?:.*\n {2}(?!- ).*)*.*)$/gm)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((q) => q[1]));
    expect(spec.length).toBeGreaterThan(systems.size);
    expect(spec.filter((h) => !titles.some((t) => t.includes(h.toLowerCase())))).toEqual([]);
    const links = [...map.matchAll(/\]\((memory\/[^)]+)\)/g)].map((m) => `docs/${m[1]}`);
    expect(links.filter((f) => !existsSync(f))).toEqual([]);
  });
});

describe('test:near', () => {
  it('a test is near a file it imports, by path or folder index, or a doc it names', () => {
    expect(near("import { x } from '../../src/engine/gear';", 'src/engine/gear.ts')).toBe(true);
    expect(near("import { x } from '../../src/engine/gearScale';", 'src/engine/gear.ts')).toBe(false);
    expect(near("import { ruleset } from '../../src/ruleset';", 'src/ruleset/index.ts')).toBe(true);
    expect(near("readFileSync('docs/build-spec.md', 'utf8')", 'docs/build-spec.md')).toBe(true);
  });

  it('picks changed tests and the tests near changed files', () => {
    const text: Record<string, string> = { 'a.test.ts': "from '../src/x'", 'b.test.ts': "from '../src/y'", 'c.test.ts': '' };
    expect(pick(['src/x.ts', 'c.test.ts'], Object.keys(text), (f) => text[f])).toEqual(['a.test.ts', 'c.test.ts']);
  });
});
