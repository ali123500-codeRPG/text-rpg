// docs/systems.md places every source file in a game system, with its spec sections and history; npm run test:near
// (scripts/test-near.ts) picks the tests nearest a change from it. A new file fails here until it is placed.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WHOLE_SUITE, changedWords, importGraph, near, nearPrefixes, ownExports, pick, selects, systemFiles, testFiles } from '../../scripts/test-near';

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

  it('links only spec topics and history files that exist', () => {
    const links = [...map.matchAll(/\]\(((?:spec|memory)\/[^)]*)\)/g)].map((m) => `docs/${m[1]}`);
    expect(links.filter((l) => l.startsWith('docs/spec/')).length).toBeGreaterThan(systems.size);
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

  it('a key renamed on a changed src line reaches the tests that select by it, in either quote style', () => {
    const words = changedWords("-  add('look', 'use', 'Look around', []);\n+  add('search', 'use', 'Search', []);\n   add('skip', 'use');");
    expect(words).toEqual(['look', 'use', 'search', 'Search']);
    expect(selects('page.locator(\'[data-kind="search"]\')', words)).toBe(true);
    expect(selects("el.querySelector(\"[data-kind='look']\")", words)).toBe(true);
    expect(selects('const look = 1;', words)).toBe(false);
  });

  it('follows a change through its folder and through barrels, name by name', () => {
    const text: Record<string, string> = {
      'src/save/checks.ts': 'export function checkInvariants() {}',
      'src/save/index.ts': "import { checkInvariants } from './checks';\nexport function loadStory() { checkInvariants(); }",
      'src/engine/resolve.ts': 'export function resolveTurn() {}',
      'src/engine/xp.ts': 'export const awardXp = () => 0;',
      'src/engine/index.ts': "export { resolveTurn } from './resolve';\nexport * from './xp';",
      'tests/unit/save.test.ts': "import { loadStory } from '../../src/save';",
      'tests/unit/turn.test.ts': "import { resolveTurn } from '../../src/engine';",
      'tests/unit/xp.test.ts': "import { awardXp } from '../../src/engine';",
    };
    const read = (f: string) => text[f];
    const graph = importGraph(Object.keys(text), read, (f) => f in text);
    const tests = Object.keys(text).filter((f) => f.endsWith('.test.ts'));
    // the miss found on #1176: save.test.ts reaches checks.ts only through src/save/index.ts
    expect(pick(['src/save/checks.ts'], tests, read, [], graph)).toEqual(['tests/unit/save.test.ts']);
    expect(pick(['src/engine/resolve.ts'], tests, read, [], graph)).toEqual(['tests/unit/turn.test.ts']);
    expect(pick(['src/engine/xp.ts'], tests, read, [], graph)).toEqual(['tests/unit/xp.test.ts']);
    expect(ownExports("export const a = 1;\nexport async function b() {}\nexport type C = 1;\nexport { d, e as f };")).toEqual(['a', 'b', 'C', 'd', 'f']);
  });

  it('on the real repo, a change to the save checks reaches the save test it once missed', () => {
    const read = (f: string) => readFileSync(f, 'utf8');
    const graph = importGraph([...testFiles('src', '.ts'), ...testFiles('tests', '.ts')], read, existsSync);
    expect(pick(['src/save/checks.ts'], testFiles(), read, [], graph)).toContain('tests/unit/save.test.ts');
  });

  it('a change to how tests are built or run runs the whole suite', () => {
    for (const f of ['package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts', 'vitest.shared.config.ts', 'vitest.mocked.config.ts', 'tests/harness/turnCheckSetup.ts']) expect(WHOLE_SUITE.test(f), f).toBe(true);
    for (const f of ['src/config.ts', 'tests/unit/save.test.ts', 'scripts/test-near.ts']) expect(WHOLE_SUITE.test(f), f).toBe(false);
  });

  it('every browser test names what it reaches, and each prefix matches a real file', () => {
    const smoke = testFiles('tests/smoke', '.smoke.ts');
    expect(smoke.length).toBeGreaterThan(0);
    const all = [...readdirSync('src', { recursive: true, encoding: 'utf8' }).map((f: string) => `src/${f.split('\\').join('/')}`), ...testFiles('tests', '.ts')];
    for (const f of smoke) {
      const pre = nearPrefixes(readFileSync(f, 'utf8'));
      expect(pre.length, `${f} needs a // near: line`).toBeGreaterThan(0);
      expect(pre.filter((p) => !all.some((x) => x.startsWith(p))), f).toEqual([]);
    }
  });
});
