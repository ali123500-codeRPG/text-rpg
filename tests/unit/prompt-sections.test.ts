// The agents' fixed instructions are written one text line per source line, so two edits to different rules touch
// different lines and merge cleanly. A whole prompt packed onto one line with escaped newlines must not come back.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';

describe('prompt sections', () => {
  it('no long line in prompts.ts packs several text lines together with escaped newlines', () => {
    const lines = (readFileSync('src/agents/prompts.ts', 'utf8') as string).split('\n');
    // a numbered rule helper opens with one escaped newline before its number; that one is not a packed line
    const packed = lines
      .map((l, i) => ({ line: i + 1, length: l.length, escapes: l.replace(/`\\n\$\{n\}/g, '').split('\\n').length - 1 }))
      .filter((l) => l.length > 400 && l.escapes > 0);
    expect(packed).toEqual([]);
  });
});
