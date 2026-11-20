// Run the tests nearest a change first, before the full `npm test` that every PR still needs. Run with
// `npm run test:near -- [system key | path ...] [--list] [--smoke]`:
//   (nothing)       the files changed since the branch left origin/main, committed or not
//   gear, senses    every code file docs/systems.md lists under that system
//   src/x.ts        that file
// A test is near a changed file when it imports it, or imports a file that reaches it: a file in the same folder that
// imports it (src/save/index.ts for src/save/checks.ts), or a barrel (index.ts) that re-exports one of its names, which
// counts only when the test imports such a name. It is also near when it names the path (a doc a test reads) or, for
// changed src lines, selects an element by a quoted word on them (`[data-kind="search"]`). The whole import graph is not
// followed: nearly every test reaches every file through tests/harness and the engine, so it would pick the whole suite.
// Conservative fallback: a change to the build or test set-up (package.json, tsconfig, vitest configs, the setup file),
// or a src file nothing imports and no browser test names, runs the whole suite. A changed file no test reaches is
// named in a warning. Browser tests that reach the change are listed, and run with --smoke. It ends PASSED, FAILED,
// NOTHING TESTED (exit 3) or could not pick tests (exit 2). Plain-syntax TypeScript so Node 22 runs it;
// tests/unit/systems-map.test.ts checks it.
// @ts-expect-error Node types are not installed; Node runs this file
import { execFileSync, spawnSync } from 'node:child_process';
// @ts-expect-error Node types are not installed; Node runs this file
import { existsSync, readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error Node types are not installed; Node runs this file
import { dirname, join, normalize } from 'node:path';
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

/** a browser test builds the whole page, so it names what it reaches on a `// near:` line of path prefixes */
export function nearPrefixes(testText: string): string[] {
  return /^\/\/ near: (.+)$/m.exec(testText)?.[1].split(/\s+/).filter(Boolean) ?? [];
}

/** one import or re-export: the file it names (null: a package, or a path that does not resolve), and the names it
 *  takes (null: all of them, as with `import * as`, a default import, a side-effect import or a vi.mock) */
export type Edge = { spec: string; file: string | null; names: string[] | null; reexport: boolean };

const IMPORT = /\b(import|export)\s+(type\s+)?([^'"`;]*?)\s*from\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\bvi\.mock\(\s*['"]([^'"]+)['"]/g;

/** a relative specifier to the file it loads: x.ts, or x/index.ts */
export function resolveSpec(from: string, spec: string, exists: (f: string) => boolean): string | null {
  if (!spec.startsWith('.')) return null;
  const b = normalize(join(dirname(from), spec)).split('\\').join('/');
  return [b, `${b}.ts`, `${b}/index.ts`].find((c) => c.endsWith('.ts') && exists(c)) ?? null;
}

export function edges(from: string, text: string, exists: (f: string) => boolean): Edge[] {
  const out: Edge[] = [];
  for (const m of text.matchAll(IMPORT)) {
    const spec = m[4] ?? m[5] ?? m[6] ?? m[7];
    const clause = m[3] ?? '';
    const braces = /^\{([^}]*)\}$/.exec(clause.trim());
    const names = braces ? braces[1].split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean) : null;
    out.push({ spec, file: resolveSpec(from, spec, exists), names, reexport: m[1] === 'export' });
  }
  return out;
}

/** the names a file exports from its own code */
export function ownExports(text: string): string[] {
  const decl = [...text.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  const listed = [...text.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}\s*;?\s*$/gm)].flatMap((m) => m[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop()!.replace(/^type\s+/, '')));
  return [...new Set([...decl, ...listed.filter(Boolean)])];
}

/** The files that carry a change to `target` to a test, each with the names that do (null: all of them): the target;
 *  the files in its folder that import it (their own code may call it); and barrels (index.ts) that re-export a name
 *  of one of those, through any chain of barrels. */
export function reach(target: string, graph: Map<string, Edge[]>, read: (f: string) => string): Map<string, Set<string> | null> {
  const R = new Map<string, Set<string> | null>([[target, null]]);
  for (const [f, es] of graph) if (f !== target && dirname(f) === dirname(target) && es.some((e) => e.file === target && !e.reexport)) R.set(f, null);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [f, es] of graph) {
      if (!f.endsWith('/index.ts')) continue;
      for (const e of es) {
        if (!e.reexport || !e.file || !R.has(e.file)) continue;
        const from = R.get(e.file);
        const offered = from ?? new Set(ownExports(read(e.file)));
        const names = (e.names ?? [...offered]).filter((n) => offered.has(n));
        if (R.get(f) === null) continue;
        const had = R.get(f) ?? new Set<string>();
        const size = R.has(f) ? had.size : -1;
        for (const n of names) had.add(n);
        if (had.size > size) {
          R.set(f, had);
          grew = true;
        }
      }
    }
  }
  return R;
}

/** does the test import a file in the reach, taking at least one name that carries the change? */
export function reaches(testEdges: Edge[], R: Map<string, Set<string> | null>): boolean {
  return testEdges.some((e) => {
    if (!e.file || !R.has(e.file)) return false;
    const carried = R.get(e.file);
    return !carried || e.names === null || e.names.some((n) => carried.has(n));
  });
}

/** changes to these run the whole suite: they change how every test is built or run */
export const WHOLE_SUITE = /^(package(-lock)?\.json|tsconfig\.json|vitest(\.[a-z]+)?\.config\.ts|tests\/harness\/turnCheckSetup\.ts)$/;

export function testFiles(dir = 'tests', end = '.test.ts'): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f: string) => f.endsWith(end))
    .map((f: string) => join(dir, f).split('\\').join('/'));
}

/** the tests near the changed or named paths. `graph` (file → its edges) adds the tests an import chain reaches. */
export function pick(paths: string[], tests: string[], read: (f: string) => string, words: string[] = [], graph?: Map<string, Edge[]>): string[] {
  const reachOf = graph ? paths.filter((p) => graph.has(p)).map((p) => reach(p, graph, read)) : [];
  return tests.filter((t) => paths.includes(t) || paths.some((p) => near(read(t), p)) || selects(read(t), words)
    || (graph ? reachOf.some((R) => reaches(graph.get(t) ?? [], R)) : false));
}

/** every .ts file under src and tests, with its edges */
export function importGraph(files: string[], read: (f: string) => string, exists: (f: string) => boolean): Map<string, Edge[]> {
  return new Map(files.map((f) => [f, edges(f, read(f), exists)]));
}

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 }) as string;
const base = () => git('merge-base', 'HEAD', 'origin/main').trim();

function changed(): string[] {
  return (git('diff', '--name-only', base()) + git('ls-files', '--others', '--exclude-standard')).split('\n').filter(Boolean);
}

function main(args: string[]): number {
  const list = args.includes('--list');
  const asked = args.filter((a) => !a.startsWith('--'));
  const systems = systemFiles(readFileSync('docs/systems.md', 'utf8'));
  const unknown = asked.filter((a) => !a.includes('/') && !a.includes('.') && !systems.has(a));
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
  const cache = new Map<string, string>();
  const read = (f: string) => cache.get(f) ?? (cache.set(f, readFileSync(f, 'utf8')), cache.get(f)!);
  const graph = importGraph([...testFiles('src', '.ts'), ...testFiles('tests', '.ts')], read, existsSync);
  const imported = new Set([...graph.values()].flatMap((es) => es.map((e) => e.file)));
  const smokeFiles = testFiles('tests/smoke', '.smoke.ts');
  const coveredBySmoke = (p: string) => smokeFiles.filter((t) => nearPrefixes(read(t)).some((pre) => p.startsWith(pre)));
  const smoke = smokeFiles.filter((t) => pick(paths, [t], read, words, graph).length || paths.some((p) => coveredBySmoke(p).includes(t)));
  // conservative fallback: what changes every test's build or run, or code reached by no import we can see
  const whole = paths.filter((p) => WHOLE_SUITE.test(p));
  const unseen = paths.filter((p) => p.startsWith('src/') && p.endsWith('.ts') && !p.endsWith('.d.ts') && existsSync(p) && !imported.has(p) && !coveredBySmoke(p).length);
  if (whole.length || unseen.length) {
    const why = whole.length ? `${whole.join(', ')} change${whole.length > 1 ? '' : 's'} how every test runs` : `nothing imports ${unseen.join(', ')}, so its tests cannot be traced`;
    console.log(`test:near: running the whole suite: ${why}.`);
    if (list) return 0;
    return run([['vitest.shared.config.ts', []], ['vitest.mocked.config.ts', []]], 'the whole suite', smoke, args.includes('--smoke'));
  }
  const tests = pick(paths, testFiles(), read, words, graph);
  console.log(`${tests.length} test files near ${paths.length} changed or named files.`);
  // a changed code file that no test reaches is named, even when other files of the change are tested
  for (const p of paths.filter((x) => /^src\/.*\.(ts|css)$/.test(x) && !x.endsWith('.d.ts'))) {
    if (pick([p], tests, read, words, graph).length) continue;
    const browser = smoke.filter((t) => pick([p], [t], read, words, graph).length || coveredBySmoke(p).includes(t));
    console.warn(`test:near: WARNING: no unit or scenario test reaches ${p}${browser.length ? `; only browser tests: ${browser.join(' ')}` : '; add one, or run `npm test`'}.`);
  }
  if (!tests.length && !list) {
    // a run that tested nothing must not read as a pass: exit 3, so `npm run test:near && git push` stops
    console.error('test:near: NOTHING TESTED. No test imports or names what you changed. Run the tests you expect by path, or `npm test`.');
    if (smoke.length) console.error(`Only browser tests reach it: npm run test:near -- --smoke, or npm run smoke -- ${smoke.join(' ')}`);
    return 3;
  }
  if (smoke.length && !args.includes('--smoke')) console.log(`Browser tests that reach what you changed: ${smoke.join(' ')}. Run them with --smoke, or leave them to the PR's checks.`);
  if (list) {
    console.log(tests.join('\n'));
    return 0;
  }
  // the vi.mock files need their own fresh module load, as in npm test
  const mocked = readFileSync('vitest.shared.config.ts', 'utf8').match(/'tests\/[^']+\.test\.ts'/g)?.map((s: string) => s.slice(1, -1)) ?? [];
  return run([
    ['vitest.shared.config.ts', tests.filter((t) => !mocked.includes(t))],
    ['vitest.mocked.config.ts', tests.filter((t) => mocked.includes(t))],
  ], `${tests.length} test files near your change`, smoke, args.includes('--smoke'));
}

/** vitest per config ([] = every file it includes), then the browser tests when asked */
function run(runs: [string, string[]][], what: string, smoke: string[], withSmoke: boolean): number {
  const all = runs.every(([, files]) => !files.length);
  const steps: [string, string[]][] = [...runs.filter(([, files]) => all || files.length), ...(withSmoke && smoke.length ? [['vitest.smoke.config.ts', smoke] as [string, string[]]] : [])];
  for (const [config, files] of steps) {
    const r = spawnSync('npx', ['vitest', 'run', '--config', config, ...files], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`test:near: FAILED (vitest exit ${r.status ?? 'none'}${r.error ? `: ${r.error.message}` : ''}).`);
      return r.status || 1;
    }
  }
  console.log(`test:near: PASSED, ${what}${withSmoke && smoke.length ? ` and ${smoke.length} browser test files` : ''}. The PR's checks still run the full suite.`);
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
