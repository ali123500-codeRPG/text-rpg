// BG-318: the map is a pop-up from the Play header (PR #798), not a page, so no text a player sees may point to a "Map page".
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync } from 'node:fs';

describe('no player text names a Map page (BG-318)', () => {
  it('no string literal in src/ui says "Map page" or "Map tab"', () => {
    const hits: string[] = [];
    for (const f of readdirSync('src/ui').filter((f: string) => f.endsWith('.ts'))) {
      const code: string = readFileSync(`src/ui/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''); // comments may name it
      for (const m of code.matchAll(/(['"`])(?:(?!\1)[^\\]|\\.)*?\bMap (?:page|tab)\b(?:(?!\1)[^\\]|\\.)*?\1/g)) hits.push(`${f}: ${m[0]}`);
    }
    expect(hits).toEqual([]);
  });
});
