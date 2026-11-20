// Run the tests nearest a change first, before the full `npm test` that every PR still needs. Run with
// `npm run test:near -- [system key | path ...] [--list]`:
//   (nothing)       the files changed since the branch left origin/main, committed or not
//   gear, senses    every code file docs/systems.md lists under that system
//   src/x.ts        that file
// A test is near a file when it imports it directly or names its path (a doc a test reads). Nearly every test reaches
// every file through tests/harness, so a whole import-graph pick (vitest related) selects the whole suite.
// Plain-syntax TypeScript so Node 22 runs it as is; tests/unit/test-near.test.ts checks the pick.
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

export function testFiles(dir = 'tests'): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f: string) => f.endsWith('.test.ts'))
    .map((f: string) => join(dir, f).split('\\').join('/'));
}

export function pick(paths: string[], tests: string[], read: (f: string) => string): string[] {
  return tests.filter((t) => paths.includes(t) || paths.some((p) => near(read(t), p)));
}

function changed(): string[] {
  const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
  const base = git('merge-base', 'HEAD', 'origin/main')[0];
  return [...git('diff', '--name-only', base), ...git('ls-files', '--others', '--exclude-standard')];
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
  const tests = pick(paths, testFiles(), (f) => readFileSync(f, 'utf8'));
  console.log(`${tests.length} test files near ${paths.length} changed or named files.`);
  if (list || !tests.length) {
    if (list) console.log(tests.join('\n'));
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
    if (r.status !== 0) return r.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
