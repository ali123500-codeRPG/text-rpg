import { describe, expect, it } from 'vitest';
import { ACTIONS, ACTION_TYPES, unlistedActions } from '../../src/library/actions';
import { CONTEST } from '../../src/library/contests';
import { getLibrary } from '../../src/library';
import { FUNCTION_NAMES } from '../../src/library/functionNames';
import { SK } from '../../src/library/skillIds';
import { PERK_MOVES } from '../../src/ruleset';

// The library viewer's Actions tab (src/library/actions.ts): every action the Parser or an NPC can take has a row,
// and every skill, function and perk a row names exists, so the tab cannot fall behind the action lists.
describe('Actions tab', () => {
  const lib = getLibrary();
  const rows = ACTIONS.flatMap((g) => g.rows);
  it('lists every Parser and NPC action', () => {
    expect(unlistedActions()).toEqual([]);
    expect(ACTIONS.find((g) => g.key === 'actions')!.rows.map((r) => r.id).sort()).toEqual([...ACTION_TYPES].sort());
  });
  it('lists every perk move', () => {
    expect(ACTIONS.find((g) => g.key === 'moves')!.rows.map((r) => r.id).sort()).toEqual(Object.keys(PERK_MOVES).sort());
  });
  it('names only skills, functions and perks that exist', () => {
    for (const r of rows) {
      for (const s of [r.roll, r.against]) {
        for (const id of s?.skills ?? []) expect(lib.skills[id], `${r.id}: ${id}`).toBeTruthy();
        for (const f of s?.fns ?? []) expect((FUNCTION_NAMES as Record<string, string>)[f], `${r.id}: ${f}`).toBeTruthy();
      }
    }
    for (const g of ACTIONS.filter((x) => x.key !== 'actions')) for (const r of g.rows) if (r.id.startsWith('PK')) expect(lib.perks[r.id], r.id).toBeTruthy();
  });
  it('shows the same skill pairs the engine rolls', () => {
    const sizeUp = rows.find((r) => r.id === 'size_up')!;
    expect(sizeUp.roll?.skills).toEqual([CONTEST.size_up.roll]);
    expect(sizeUp.against?.skills).toEqual([CONTEST.size_up.against]);
    const deceive = rows.find((r) => r.id === 'deceive')!;
    expect(deceive.roll?.skills).toEqual([SK.falsehood]);
    expect(deceive.against?.skills).toEqual([SK.insight]);
    expect(rows.find((r) => r.id === 'talk')!.roll).toBeNull(); // plain talk rolls nothing
  });
});
