// npm run sync (scripts/sync.ts): after a rebase, every line the branch added must still be in its file.
import { describe, expect, it } from 'vitest';
import { addedLines, missing } from '../../scripts/sync';

const diff = [
  'diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '@@ -1 +1,3 @@', ' keep', '+one', '+one', '+',
  'diff --git a/gone.ts b/gone.ts', '--- a/gone.ts', '+++ b/gone.ts', '@@ -0,0 +1 @@', '+mine',
  'diff --git a/old.ts b/old.ts', '--- a/old.ts', '+++ /dev/null', '@@ -1 +0,0 @@', '-removed',
].join('\n');

describe('sync check', () => {
  it('reads the non-blank lines a diff adds, per file, and none from a deleted file', () => {
    expect([...addedLines(diff)]).toEqual([['a.ts', ['one', 'one']], ['gone.ts', ['mine']]]);
  });

  it('a line added twice must be there twice; a file taken whole from the other side loses its lines', () => {
    const now: Record<string, string> = { 'a.ts': 'keep\none', 'gone.ts': 'theirs only' };
    expect([...missing(addedLines(diff), (f) => now[f] ?? null)]).toEqual([['a.ts', ['one']], ['gone.ts', ['mine']]]);
    expect(missing(addedLines(diff), () => 'one\none\nmine').size).toBe(0);
  });
});
