// Run the tests nearest a change first, before the full `npm test` that every PR still needs. Run with
// `npm run test:near -- [system key | path ...] [--list]`:
//   (nothing)       the files changed since the branch left origin/main, committed or not
//   gear, senses    every code file docs/systems.md lists under that system
//   src/x.ts        that file
// A test is near a file when it imports it directly or names its path (a doc a test reads), or, for changed src lines,
// when it selects an element by a quoted word on them (`[data-kind="search"]`). Nearly every test reaches every file
// through tests/harness, so a whole import-graph pick (vitest related) selects the whole suite. Browser tests that
// are near are listed, not run. It ends PASSED, FAILED, NOTHING TESTED (exit 3) or could not pick tests (exit 2). Plain-syntax TypeScript so Node 22 runs it; tests/unit/systems-map.test.ts checks it.
// @ts-expect-error Node types are not installed; Node runs this file
import { execFileSync, spawnSync } from 'node:child_process';
// @ts-expect-error Node types are not installed; Node runs this file
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error Node types are not installed; Node runs this file
import { join } from 'node:path';
// @ts-expect-error Node types are not installed; Node runs this file
import { pathToFileURL } from 'node:url';

declare const process: { argv: string[]; exitCode?: number };

/** system key → the code paths its "- Code:" list names in docs/systems.md, one `path` per indented line */
export function systemFiles(map: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let key = '';
  let inCode = false;
  for (const l of map.split('\n')) {
    const head = /^## ([a-z-]+):/.exec(l);
    if (head) [key, inCode] = [head[1], false];
    else if (l.startsWith('- Code:')) inCode = true;
    else if (inCode && /^\s+- `/.test(l)) out.set(key, [...(out.get(key) ?? []), /`([^`]+)`/.exec(l)![1]]);
    else if (!/^\s/.test(l)) inCode = false;
  }
  return out;
}

/** does this test file's text import the path, or name it? */
export function near(testText: string, path: string): boolean {
  const bare = path.replace(/\.ts$/, '').replace(/\/index$/, '');
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // a test imports a harness file as '../harness/x', without the tests/ folder
  const forms = [...new Set([path, path.replace(/\.ts$/, ''), bare, bare.replace(/^tests\//, '')])].map(esc).join('|');
  return new RegExp(`(^|[/'"\`])(${forms})['"\`]`, 'm').test(testText);
}

/** the quoted words on changed lines: a key renamed in src ('look' to 'search') changes what a test's selector finds */
export function changedWords(diff: string): string[] {
  const lines = diff.split('\n').filter((l) => /^[+-](?![+-])/.test(l));
  return [...new Set(lines.flatMap((l) => [...l.matchAll(/['"`]([a-z][\w-]{2,})['"`]/gi)].map((m) => m[1])))];
}

/** does the test select an element by one of these words, as an attribute value in either quote style? */
export function selects(testText: string, words: string[]): boolean {
  return words.some((w) => testText.includes(`="${w}"`) || testText.includes(`='${w}'`));
}

export function testFiles(dir = 'tests', end = '.test.ts'): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f: string) => f.endsWith(end))
    .map((f: string) => join(dir, f).split('\\').join('/'));
}

export function pick(paths: string[], tests: string[], read: (f: string) => string, words: string[] = []): string[] {
  return tests.filter((t) => paths.includes(t) || paths.some((p) => near(read(t), p)) || selects(read(t), words));
}

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 }) as string;
const base = () => git('merge-base', 'HEAD', 'origin/main').trim();

function changed(): string[] {
  return (git('diff', '--name-only', base()) + git('ls-files', '--others', '--exclude-standard')).split('\n').filter(Boolean);
}

function main(args: string[]): number {
  const list = args.includes('--list');
  const asked = args.filter((a) => a !== '--list');
  const systems = systemFiles(readFileSync('docs/systems.md', 'utf8'));
  const unknown = asked.filter((a) => !a.includes('/') && !systems.has(a));
  if (unknown.length) {
    console.error(`No system ${unknown.join(', ')} in docs/systems.md. Keys: ${[...systems.keys()].join(', ')}`);
    return 1;
  }
  // a system's ID tables (src/library/*Ids.ts) are keys most tests import as fixtures; they count only when changed
  const ofSystem = (a: string) => systems.get(a)?.filter((p) => !/Ids\.ts$/.test(p));
  const named = asked.length ? asked.flatMap((a) => ofSystem(a) ?? [a]) : changed();
  // the spec is read through one harness file, so a spec change is near every test that imports it
  const paths = named.some((p) => p === 'docs/build-spec.md' || p.startsWith('docs/spec/')) ? [...named, 'tests/harness/specDocs.ts'] : named;
  const words = asked.length ? [] : changedWords(git('diff', '--no-color', base(), '--', 'src'));
  const read = (f: string) => readFileSync(f, 'utf8');
  const tests = pick(paths, testFiles(), read, words);
  const smoke = pick(paths, testFiles('tests/smoke', '.smoke.ts'), read, words);
  console.log(`${tests.length} test files near ${paths.length} changed or named files.`);
  if (!tests.length && !list) {
    // a run that tested nothing must not read as a pass: exit 3, so `npm run test:near && git push` stops
    console.error('test:near: NOTHING TESTED. No test imports or names what you changed. Run the tests you expect by path, or `npm test`.');
    if (smoke.length) console.error(`Only browser tests reach it: npm run smoke -- ${smoke.join(' ')}`);
    return 3;
  }
  if (smoke.length) console.log(`Browser tests that reach what you changed: npm run smoke -- ${smoke.join(' ')} (or leave them to the PR's checks).`);
  if (list) {
    console.log(tests.join('\n'));
    return 0;
  }
  // the vi.mock files need their own fresh module load, as in npm test
  const mocked = readFileSync('vitest.shared.config.ts', 'utf8').match(/'tests\/[^']+\.test\.ts'/g)?.map((s: string) => s.slice(1, -1)) ?? [];
  const runs = [
    ['vitest.shared.config.ts', tests.filter((t) => !mocked.includes(t))],
    ['vitest.mocked.config.ts', tests.filter((t) => mocked.includes(t))],
  ] as const;
  for (const [config, files] of runs) {
    if (!files.length) continue;
    const r = spawnSync('npx', ['vitest', 'run', '--config', config, ...files], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`test:near: FAILED (vitest exit ${r.status ?? 'none'}${r.error ? `: ${r.error.message}` : ''}).`);
      return r.status || 1;
    }
  }
  console.log(`test:near: PASSED, ${tests.length} test files near your change. The PR's checks still run the full suite.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`test:near: could not pick tests: ${(e as Error).message}`);
    process.exitCode = 2;
  }
}
