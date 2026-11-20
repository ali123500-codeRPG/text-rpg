// npm run sync (scripts/sync.ts): after a rebase, every line the branch added must still be in its file.
import { describe, expect, it } from 'vitest';
import { addedLines, autoResolve, missing } from '../../scripts/sync';

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

  it('two entries added at the top of a log are both kept, the branch\'s first; nothing else is touched', () => {
    const c = (ours: string, base: string, theirs: string) => `# Log\n\n<<<<<<< HEAD\n${ours}||||||| parent\n${base}=======\n${theirs}>>>>>>> abc (mine)\n- old entry\n`;
    expect(autoResolve(c('- main\'s entry\n', '', '- my entry\n'))).toBe('# Log\n\n- my entry\n- main\'s entry\n- old entry\n');
    expect(autoResolve(c('- same\n', '', '- same\n'))).toBe('# Log\n\n- same\n- old entry\n');
    expect(autoResolve(c('## BG-2\nmain\n', '', '## BG-3\nmine\n'), true)).toBe('# Log\n\n## BG-3\nmine\n\n## BG-2\nmain\n- old entry\n');
  });

  it('a conflict where either side changed an existing line is left for a person', () => {
    expect(autoResolve('<<<<<<< HEAD\n- edited by main\n||||||| base\n- the old line\n=======\n- edited here\n>>>>>>> abc\n')).toBeNull();
    expect(autoResolve('<<<<<<< HEAD\n- a\n=======\n- b\n>>>>>>> abc\n')).toBeNull(); // no base shown: not provably two insertions
  });
});

