// PR #1085 merged docs/bug-fix-log.md with git conflict markers still in it; tsc only checks .ts files, so a marker in a
// doc, a stylesheet or a script passed CI. This scans every source and doc file for them.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';

const ROOTS = ['docs', 'src', 'tests', 'scripts'];
const EXT = /\.(ts|mjs|js|css|md|html|json)$/;
const MARKER = /^(<{7}|>{7}) /m;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n: string) => {
    const p = `${dir}/${n}`;
    return statSync(p).isDirectory() ? files(p) : EXT.test(n) ? [p] : [];
  });
}

describe('no merge conflict markers', () => {
  it('no source or doc file holds a <<<<<<< or >>>>>>> line', () => {
    const hits = ROOTS.flatMap(files).filter((f) => MARKER.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
