// SP2 learning window: a use marks a skill when the opposition is from MARK_WINDOW below its raw skill up to
// MARK_WINDOW above its true skill. A skill not on the sheet counts as raw 0 and joins the sheet with its first gain.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { improveMarked, markIfClose } from '../../src/ruleset/improve';
import { SK } from '../../src/library/skillIds';

describe('learning window', () => {
  it('runs from raw − 10 to true + 10', () => {
    const s = makeVillage(), p = s.player;
    p.core.skills[SK.dodge] = { raw: 30, state: 'normal' };
    const marked = (opp: number) => { p.progression!.marks = []; markIfClose(s, p, SK.dodge, opp); return p.progression!.marks.length === 1; };
    expect([19, 20, 40, 41].map(marked)).toEqual([false, true, true, false]);
  });
  it('a skill not on the sheet is marked at raw 0 and joins the sheet when it improves', () => {
    const s = makeVillage(), p = s.player;
    delete p.core.skills[SK.unarmed_strike];
    p.progression!.marks = [];
    markIfClose(s, p, SK.unarmed_strike, 25);
    expect(p.progression!.marks).toEqual([]); // 25 is above 0 + 10
    markIfClose(s, p, SK.unarmed_strike, 8);
    expect(p.progression!.marks).toEqual([SK.unarmed_strike]);
    const gains = improveMarked(s, createRng(1));
    expect(gains.map((g) => g.skill)).toContain(SK.unarmed_strike);
    expect(p.core.skills[SK.unarmed_strike]).toMatchObject({ state: 'normal' });
    expect(p.core.skills[SK.unarmed_strike].raw).toBeGreaterThan(0);
  });
});
