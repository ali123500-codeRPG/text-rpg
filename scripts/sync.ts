// Bring a branch up to date with origin/main without losing its own edits. Run with `npm run sync`:
//   (nothing)            fetch origin/main, rebase onto it, then check every line this branch added is still there
//   --check <old head>   only the check, after a rebase or merge done by hand (`npm run sync -- --check ORIG_HEAD`)
// A conflict stops the rebase with what to do, except one kind: both sides only added new entries at the same spot of
// a log or ID table (LOGS below). Those are kept both, this branch's first, with no other change (autoResolve). Taking one side of a whole file (`git checkout --ours/--theirs`) drops
// every edit of the other side in that file, which is how edits went missing before; the check catches that.
// Plain-syntax TypeScript so Node 22 runs it as is; tests/unit/sync-check.test.ts checks the comparison.
// @ts-expect-error Node types are not installed; Node runs this file
import { execFileSync, spawnSync } from 'node:child_process';
// @ts-expect-error Node types are not installed; Node runs this file
import { readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; Node runs this file
import { pathToFileURL } from 'node:url';

declare const process: { argv: string[]; exitCode?: number };

const git = (...a: string[]): string => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });

/** logs and ID tables where two PRs adding an entry at the same spot (a log's top, a table's end) always meet; only
 *  pure additions there are resolved */
export const LOGS = [
  'CHANGELOG.md', 'docs/bug-fix-log.md',
  'docs/spec/deferred-items.md', 'docs/spec/deferred-items-archive.md', 'docs/spec/perk-ideas.md', 'docs/spec/achievement-ideas.md', 'docs/spec/vow-ideas.md', 'docs/spec/class-ideas.md', 'docs/spec/essence-ideas.md', 'docs/spec/threadbound-ideas.md',
  'docs/spec/combat-ideas.md', 'docs/spec/item-ideas.md', 'docs/spec/world-ideas.md', 'docs/spec/npc-ideas.md', 'docs/spec/age-ideas.md', 'docs/spec/open-questions.md',
];

/** a conflicted file (diff3 marks) with both sides keeping, or null when any conflict is more than two insertions at one
 *  spot: the base between them must be empty. In a rebase "ours" is main and "theirs" is this branch's newer entry, so
 *  the branch's entry goes first; an entry both sides added word for word is kept once. */
export function autoResolve(text: string, blankBetween = false): string | null {
  const mark = /^<<<<<<< [^\n]*\n([\s\S]*?)^\|\|\|\|\|\|\| [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/m;
  let out = text;
  for (let m = mark.exec(out); m; m = mark.exec(out)) {
    const [whole, ours, base, theirs] = m;
    if (base.trim()) return null;
    const sep = blankBetween && !theirs.endsWith('\n\n') ? '\n' : '';
    out = out.slice(0, m.index) + (ours === theirs ? ours : theirs + sep + ours) + out.slice(m.index + whole.length);
  }
  return /^(<<<<<<<|=======|>>>>>>>)( |$)/m.test(out) ? null : out;
}

/** file → the non-blank lines a diff adds to it */
export function addedLines(diff: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let file = '';
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) file = l.startsWith('+++ b/') ? l.slice(6) : '';
    else if (file && l.startsWith('+') && l.slice(1).trim()) out.set(file, [...(out.get(file) ?? []), l.slice(1)]);
  }
  return out;
}

/** the added lines that the file no longer holds as many times as they were added */
export function missing(added: Map<string, string[]>, now: (file: string) => string | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [file, lines] of added) {
    const text = now(file);
    const have = new Map<string, number>();
    for (const l of text?.split('\n') ?? []) have.set(l, (have.get(l) ?? 0) + 1);
    const lost = lines.filter((l) => {
      const n = have.get(l) ?? 0;
      have.set(l, n - 1);
      return n <= 0;
    });
    if (lost.length) out.set(file, lost);
  }
  return out;
}

function check(oldHead: string): number {
  const base = git('merge-base', oldHead, 'origin/main').trim();
  const added = addedLines(git('diff', '--no-color', '--no-renames', base, oldHead));
  const show = (f: string) => { try { return git('show', `HEAD:${f}`); } catch { return null; } };
  const lost = missing(added, show);
  if (!lost.size) {
    console.log(`Every line this branch added (${[...added.values()].flat().length} in ${added.size} files) is still there.`);
    return 0;
  }
  console.error('These lines your branch added are gone now. Check each: main may have changed it on purpose, or a conflict took one side:');
  for (const [f, ls] of lost) console.error(`\n${f}\n${ls.slice(0, 20).map((l) => `  - ${l.slice(0, 160)}`).join('\n')}${ls.length > 20 ? `\n  … ${ls.length - 20} more` : ''}`);
  console.error(`\nYour old commits are still at ${oldHead.slice(0, 12)}: \`git show ${oldHead.slice(0, 12)} -- <file>\` shows them.`);
  return 1;
}

function main(args: string[]): number {
  const at = args.indexOf('--check');
  if (at >= 0) return check(git('rev-parse', args[at + 1] ?? 'ORIG_HEAD').trim());
  if (git('status', '--porcelain', '--untracked-files=no').trim()) {
    console.error('Commit or stash your changes first: a rebase needs a clean tree.');
    return 1;
  }
  git('fetch', '-q', 'origin', 'main');
  const oldHead = git('rev-parse', 'HEAD').trim();
  // clones here often track only main, so a bare --force-with-lease has no ref to compare: name the remote tip
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
  const remote = git('ls-remote', 'origin', `refs/heads/${branch}`).split('\t')[0].trim();
  const push = remote ? `git push --force-with-lease=${branch}:${remote} origin HEAD:${branch}` : `git push -u origin HEAD:${branch}`;
  let r = spawnSync('git', ['-c', 'merge.conflictStyle=diff3', 'rebase', 'origin/main'], { stdio: 'inherit' });
  const merged = new Set<string>();
  while (r.status !== 0) {
    const stuck = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
    const fixed = stuck.length && stuck.every((f) => LOGS.includes(f))
      ? stuck.map((f) => [f, autoResolve(readFileSync(f, 'utf8'), f === 'docs/bug-fix-log.md')] as const) : [];
    if (!fixed.length || fixed.some(([, text]) => text === null)) break;
    for (const [f, text] of fixed) { writeFileSync(f, text!); git('add', f); merged.add(f); }
    r = spawnSync('git', ['-c', 'core.editor=true', '-c', 'merge.conflictStyle=diff3', 'rebase', '--continue'], { stdio: 'inherit' });
  }
  if (merged.size) console.log(`Kept both sides' new entries in ${[...merged].join(', ')} (this branch's first).`);
  if (r.status !== 0) {
    console.error([
      '',
      'The rebase stopped on a conflict. For each file `git status` lists as both modified:',
      '  - open it and keep both sides\' edits between the <<<<<<< and >>>>>>> marks; never take one side of the whole',
      '    file with `git checkout --ours` or `--theirs` unless you mean to drop every edit of the other side;',
      '  - for a generated file, run its generator instead (npm run perks-doc, for example);',
      '  - `git add` the file, `git rebase --continue`, and search the repo for leftover <<<<<<< marks.',
      `Then run \`npm run sync -- --check ${oldHead.slice(0, 12)}\`. To give up: \`git rebase --abort\`.`,
    ].join('\n'));
    return 1;
  }
  const code = check(oldHead);
  if (code === 0) console.log(`Push with \`${push}\`, then wait on the PR with \`npm run pr:wait -- <n>\`.`);
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
