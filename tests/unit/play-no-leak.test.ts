// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The encounter mode, which agents run and how many Claude calls a turn makes are hidden: the play screen must not
// read them (the GM view may). A static check, since the unit tests run without a DOM.
describe('play screen hides the mode', () => {
  const src = readFileSync('src/ui/play.ts', 'utf8');
  it('reads no mode, call count or running-agent list', () => {
    expect(src).not.toMatch(/\.mode\b/);
    expect(src).not.toMatch(/api\.calls\(/);
    expect(src).not.toMatch(/api\.working\(/);
  });
});
