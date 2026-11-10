// 157 How augmenting skills learn (AU1–AU5, option B): one window for the whole roll, from the roll's sums (raw low end,
// max(raw, true) high end, each augment × share × tier). Every augment that added to the roll marks when the other side's
// level (augments included) is inside it, or on a tie. Augments off the sheet learn once their tree opens.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { augmentWindow, markUse } from '../../src/ruleset/improve';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import type { Actor, ContestResult, GameState, RollKind } from '../../src/types';

function setup() {
  const s = makeVillage(), p = s.player, o = s.actors[0];
  p.core.classes = [{ classId: CL.merchant, state: 'current', level: 1 }];
  o.core.classes = [{ classId: CL.merchant, state: 'current', level: 1 }];
  p.progression!.marks = [];
  return { s, p, o };
}
const sheet = (a: Actor, v: Record<string, number>) => { a.core.skills = {}; for (const [id, raw] of Object.entries(v)) a.core.skills[id] = { raw, state: 'normal' }; };
function contest(s: GameState, p: Actor, o: Actor, gap: number, rollKind?: RollKind) {
  const r = (id: string) => ({ actorId: id, skill: SK.barter, ...(rollKind ? { rollKind } : {}), d100: 50, margin: 0, tier: 'success', natural: 0, modifiers: [], tierShifts: [] });
  p.progression!.marks = [];
  markUse(s, p, SK.barter, { a: r(p.id), b: r(o.id), gap, winner: gap ? (gap < 0 ? 'a' : 'b') : 'tie' } as unknown as ContestResult);
  return p.progression!.marks;
}

describe('157 augment learning', () => {
  it('Barter 30 + Shrewd Dealing 40 learns SD from totals of 60 to 80; Barter keeps its own 20 to 40', () => {
    const { s, p, o } = setup();
    sheet(p, { [SK.barter]: 30, [SK.shrewd_dealing]: 40 });
    sheet(o, { [SK.barter]: 70 });
    expect(contest(s, p, o, 2)).toEqual([SK.shrewd_dealing]);
    sheet(o, { [SK.barter]: 30 });
    expect(contest(s, p, o, -2)).toEqual([SK.barter]);
    sheet(o, { [SK.barter]: 30, [SK.shrewd_dealing]: 40 }); // AU2: a merchant counts with its own augment (70)
    expect(contest(s, p, o, 0).sort()).toEqual([SK.barter, SK.shrewd_dealing].sort()); // a tie marks everything in the roll
    expect(contest(s, p, o, 1).sort()).toEqual([SK.barter, SK.shrewd_dealing].sort()); // Barter against their true 30, SD against their 70
  });

  it('a peasant never teaches a Barter 100 merchant; a tie still marks the augment (AU4)', () => {
    const { s, p, o } = setup();
    sheet(p, { [SK.barter]: 100 });
    sheet(o, { [SK.barter]: 10 });
    expect(contest(s, p, o, -3)).toEqual([]);
    expect(contest(s, p, o, 0).sort()).toEqual([SK.barter, SK.shrewd_dealing].sort()); // AU3: SD at 0, off the sheet, learns
  });

  it('several augments share one window from the summed values; roll-kind augments learn only on their kinds (AU5)', () => {
    const { s, p, o } = setup();
    const persuasion = getLibrary().skills[SK.persuasion];
    persuasion.augments = [{ skill: SK.barter, share: 0.5 }]; // a stand-in second augment for the test
    sheet(p, { [SK.barter]: 30, [SK.shrewd_dealing]: 40, [SK.persuasion]: 10 }); // window 30 + 40 + 5 ± 10 = 65 to 85
    sheet(o, { [SK.barter]: 84 });
    expect(contest(s, p, o, 2).sort()).toEqual([SK.shrewd_dealing, SK.persuasion].sort());
    sheet(o, { [SK.barter]: 63 });
    expect(contest(s, p, o, 2)).toEqual([]);
    persuasion.augments = [{ skill: SK.barter, rollKinds: ['hit'] }];
    sheet(o, { [SK.barter]: 75 }); // window without Persuasion: 60 to 80
    expect(contest(s, p, o, 2)).toEqual([SK.shrewd_dealing]);
    delete persuasion.augments;
  });
  it('the sheet shows an augmenting skill the window of the roll it adds to (augmentWindow)', () => {
    const { p } = setup();
    sheet(p, { [SK.barter]: 30, [SK.shrewd_dealing]: 40 });
    expect(augmentWindow(p, SK.shrewd_dealing)).toEqual({ via: SK.barter, window: [60, 80] });
    expect(augmentWindow(p, SK.barter)).toBeNull();
  });
});
