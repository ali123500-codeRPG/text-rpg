// BG-149: every wasted event says why it came to nothing, so the story can tell it (a give out of reach read as
// "pushing the grate"). Every place the engine makes a wasted event names a reason.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

it('BG-149: every wasted event carries a reason', () => {
  const dir = 'src/engine';
  const bare: string[] = [];
  for (const f of (readdirSync(dir) as string[]).filter((x) => x.endsWith('.ts'))) {
    (readFileSync(`${dir}/${f}`, 'utf8') as string).split('\n').forEach((l: string, i: number) => {
      if (/mk\(ctx, \w+, 'wasted'/.test(l) && !/reason/.test(l)) bare.push(`${f}:${i + 1}`);
    });
  }
  expect(bare).toEqual([]);
});
