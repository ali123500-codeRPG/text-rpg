// TQ5 guard tests: when a meaning changes (zone links to metres, numbers to keys), a guard test bans the old pattern,
// with a short list of allowed places and why. bannedLines does the file walk, so a guard is one line.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';

const files = (dir: string, ext: RegExp): string[] => readdirSync(dir).flatMap((n: string) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p, ext) : ext.test(n) ? [p] : [];
});

/** every `file:line: text` under `roots` that matches `pattern`, except files named in `allowed` (path -> why it may).
 *  An allowed path that no longer exists or no longer has the pattern is reported too, so the list can't go stale. */
export function bannedLines(pattern: RegExp, allowed: Record<string, string> = {}, roots = ['src'], ext = /\.ts$/): string[] {
  const stale = Object.keys(allowed).filter((f) => { try { return !pattern.test(readFileSync(f, 'utf8')); } catch { return true; } }).map((f) => `${f}: allowed, but it no longer has the pattern (remove it from the list)`);
  return [...stale, ...roots.flatMap((r) => files(r, ext)).map((f) => f.replace(/\\/g, '/')).filter((f) => !allowed[f])
    .flatMap((f) => readFileSync(f, 'utf8').split('\n').map((line: string, i: number) => (pattern.test(line) ? `${f}:${i + 1}: ${line.trim().slice(0, 100)}` : '')).filter(Boolean))];
}
