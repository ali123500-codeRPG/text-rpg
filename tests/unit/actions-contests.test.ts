import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../../src/library/actions';
import { getLibrary } from '../../src/library';
import { FUNCTION_NAMES } from '../../src/library/functionNames';

// The library viewer's Actions tab (src/library/actions.ts): every action the Parser or an NPC can take has a row,
// and every skill, function and perk a row names exists, so the tab cannot fall behind the action lists.
describe('Actions tab', () => {
  const lib = getLibrary();
  const rows = ACTIONS.flatMap((g) => g.rows);
  it('names only skills, functions and perks that exist', () => {
    for (const r of rows) {
      for (const s of [r.roll, r.against]) {
        for (const id of s?.skills ?? []) expect(lib.skills[id], `${r.id}: ${id}`).toBeTruthy();
        for (const f of s?.fns ?? []) expect((FUNCTION_NAMES as Record<string, string>)[f], `${r.id}: ${f}`).toBeTruthy();
      }
    }
    for (const g of ACTIONS.filter((x) => x.key !== 'actions')) for (const r of g.rows) if (r.id.startsWith('PK')) expect(lib.perks[r.id], r.id).toBeTruthy();
  });
});
