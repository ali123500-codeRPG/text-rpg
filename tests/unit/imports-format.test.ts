// Phase 1 of the split (SX5): the busiest files keep one imported name per line, so concurrent PRs that add imports
// touch different lines. Rewrite with `node scripts/imports.ts`.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { ONE_PER_LINE, formatImports } from '../../scripts/imports';

describe('one import per line', () => {
  it.each(ONE_PER_LINE)('%s is in form', (f) => {
    const text = readFileSync(f, 'utf8');
    expect(formatImports(text) === text, `${f}: run node scripts/imports.ts`).toBe(true);
  });

  it('splits names, sorts them, keeps statement order and lifts lower imports to the header', () => {
    const before = "// head\nimport { b, type C, a as z } from './x';\nimport D, { y } from './d';\nconst k = 1;\nimport * as ns from './n';\nimport type { T } from './t';\n";
    expect(formatImports(before)).toBe("// head\nimport {\n  a as z,\n  b,\n  type C,\n} from './x';\nimport D, {\n  y,\n} from './d';\nimport * as ns from './n';\nimport type {\n  T,\n} from './t';\nconst k = 1;\n");
    expect(formatImports(formatImports(before))).toBe(formatImports(before));
  });
});
