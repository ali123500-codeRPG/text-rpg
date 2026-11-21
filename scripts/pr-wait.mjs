// Wait on one PR until it can merge, or stop the moment it cannot: `npm run pr:wait -- <n> [--merge]`.
// Exit 0: no conflict and every check on the PR's head is green (with --merge, then squash-merged at exactly that head).
// Exit 1, with the reason: a conflict (a conflicting PR gets no checks at all), a failed or cancelled check, a check
// that never started, the PR closed, or the time limit (run it again to keep waiting). One line per change of state.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const GRACE_S = 120; // check runs appear seconds after a push; one still absent after this is not coming
const POLL_S = 10;
const LIMIT_S = 540; // stays under a 10-minute tool call

/** the check-run names a PR should get: the jobs of every workflow that runs on pull_request */
// shortcut: reads job keys only, so a job with its own `name:` or a matrix would show as never started; parse those if one is added
export function expectedChecks(dir = '.github/workflows') {
  const block = (text, key) => (new RegExp(`^${key}:(.*(?:\\n(?:[ \\t].*|))*)`, 'm').exec(text)?.[1] ?? '');
  return readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) => {
    const text = readFileSync(`${dir}/${f}`, 'utf8');
    if (!/\bpull_request\b/.test(block(text, 'on'))) return [];
    return [...block(text, 'jobs').matchAll(/^ {2}([\w-]+):/gm)].map((m) => m[1]);
  });
}

/** what the PR's state means now: { done, ok, why } */
export function verdict(pr, runs, expected, waitedS) {
  const stop = (why) => ({ done: true, ok: false, why });
  if (pr.merged) return stop('already merged');
  if (pr.state !== 'open') return stop('the PR is closed');
  if (pr.mergeable === false) return stop('conflict with main, so no checks will run: `npm run sync`, push, then wait again');
  const latest = new Map(); // a re-run adds a newer run under the same name
  for (const r of [...runs].sort((a, b) => a.id - b.id)) latest.set(r.name, r);
  const bad = [...latest.values()].filter((r) => r.status === 'completed' && !['success', 'skipped', 'neutral'].includes(r.conclusion));
  if (bad.length) return stop(`failed: ${bad.map((r) => `${r.name} (${r.conclusion}) ${r.html_url}`).join(', ')}`);
  const missing = expected.filter((n) => !latest.has(n));
  if (missing.length && waitedS >= GRACE_S) return stop(`never started after ${GRACE_S} s: ${missing.join(', ')} (check the Actions tab)`);
  const pending = [...latest.values()].filter((r) => r.status !== 'completed').map((r) => r.name);
  if (missing.length || pending.length) return { done: false, why: `waiting: ${[...pending.map((n) => `${n} running`), ...missing.map((n) => `${n} not started`)].join(', ')}` };
  // GitHub works mergeability out in the background after a push; null means not yet, and asking again starts it
  if (pr.mergeable === null) return { done: false, why: 'checks green; GitHub is still working out whether it merges' };
  return { done: true, ok: true, why: `mergeable, every check green (${[...latest.keys()].join(', ')})` };
}

const api = (...a) => JSON.parse(execFileSync('gh', ['api', ...a], { encoding: 'utf8' }));
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function main(args) {
  const n = args.find((a) => /^\d+$/.test(a));
  if (!n) { console.error('usage: npm run pr:wait -- <PR number> [--merge]'); return 1; }
  const expected = expectedChecks();
  const start = Date.now();
  let sha = '', since = 0, said = '';
  for (;;) {
    const pr = api(`repos/{owner}/{repo}/pulls/${n}`);
    if (pr.head?.sha !== sha) { sha = pr.head?.sha; since = Date.now(); }
    const runs = pr.state === 'open' ? api(`repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`).check_runs : [];
    const v = verdict(pr, runs, expected, (Date.now() - since) / 1000);
    // a push while we read cancels the old head's run: judge the new head, not the old one
    if (v.done && !v.ok && api(`repos/{owner}/{repo}/pulls/${n}`).head?.sha !== sha) continue;
    if (v.why !== said) console.log(`#${n} ${sha.slice(0, 7)}: ${(said = v.why)}`);
    if (v.done && v.ok && args.includes('--merge')) {
      if (pr.draft) { console.error('still a draft: mark it ready for review, then run this again'); return 1; }
      try {
        execFileSync('gh', ['api', '-X', 'PUT', `repos/{owner}/{repo}/pulls/${n}/merge`, '-f', 'merge_method=squash', '-f', `sha=${sha}`], { stdio: 'pipe' });
        console.log(`#${n}: squash-merged at ${sha.slice(0, 7)}`);
      } catch (e) { console.error(`merge refused: ${String(e.stderr || e.message).trim()}`); return 1; }
    }
    if (v.done) return v.ok ? 0 : 1;
    if ((Date.now() - start) / 1000 > LIMIT_S) { console.error(`#${n}: still ${v.why}; run again to keep waiting`); return 1; }
    await sleep(POLL_S);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
