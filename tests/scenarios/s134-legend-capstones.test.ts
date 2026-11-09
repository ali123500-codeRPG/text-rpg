// 134 Unwritten Legend capstones: As Far as the Road Goes is the default at class level 20, its top level (tier 5; no ladder gating);
// Write Your Own Ending (needs 7 classes) and No Road Closed (needs an All-50 and 10 skills above 15) are alternates.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { awardXp, swapCapstone, xpToNext } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { CL } from '../../src/library/classIds';
import { SK } from '../../src/library/skillIds';
import { milestoneState } from '../../src/ruleset/perks';
import { treeOpen } from '../../src/ruleset/access';
import type { Actor } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'class', gainedTurn: 0 });

function legendAt19(setup: (p: Actor) => void = () => {}) {
  const s = makeVillage(), p = s.player;
  p.core.perks = [];
  p.core.classes = [{ classId: CL.late_bloomer, state: 'current', level: 19 }];
  setup(p);
  awardXp(s, xpToNext(p), 'test');
  return { s, p };
}

describe('134 Unwritten Legend capstones', () => {
  it('level 20 gives As Far as the Road Goes; alternates are offered only when their conditions hold', () => {
    const plain = legendAt19().p;
    expect(plain.core.perks.map((x) => x.perkId)).toEqual(['as_far_as_the_road_goes']);
    expect(plain.progression!.capstoneOptions).toBeUndefined();

    const seven = legendAt19((p) => {
      for (const id of [CL.swordsman, CL.sword_dancer, CL.commoner, CL.a_nobody, CL.trader, 'x1']) p.core.classes.push({ classId: id, state: 'unlocked', level: 0 });
    }).p;
    expect(seven.progression!.capstoneOptions).toEqual({ [CL.late_bloomer]: ['write_your_own_ending'] });
    expect(seven.core.perks.find((x) => x.perkId === 'as_far_as_the_road_goes')?.dormant).toBe(true); // inactive until the player picks
    expect(plain.core.perks[0].dormant).toBeUndefined(); // nothing on offer: active at once

    const ten = (p: Actor) => { for (const id of Object.keys(getLibrary().skills).slice(0, 10)) p.core.skills[id] = { raw: 16, state: 'normal' }; };
    expect(legendAt19(ten).p.progression!.capstoneOptions).toBeUndefined(); // no All-50 yet
    const both = legendAt19((p) => { ten(p); p.core.perks.push({ perkId: 'spotter', source: 'mastery', gainedTurn: 0, treeId: 'perception', tier: 50 }); }).p;
    expect(both.progression!.capstoneOptions).toEqual({ [CL.late_bloomer]: ['no_road_closed'] });
  });

  it('As Far as the Road Goes: a 60 perk opens with no 20 perk taken in the skill', () => {
    const { p } = legendAt19();
    p.core.skills[SK.melee_medium] = { raw: 60, state: 'normal' };
    expect(milestoneState(p, SK.melee_medium, 60)).not.toBe('sealed');
    p.core.perks = [];
    expect(milestoneState(p, SK.melee_medium, 60)).toBe('sealed');
  });

  it('Write Your Own Ending: swapping it in unlocks every class in the library', () => {
    const { p, s } = legendAt19((p) => {
      for (let i = 0; i < 6; i++) p.core.classes.push({ classId: `x${i}`, state: 'unlocked', level: 0 });
    });
    expect(swapCapstone(p, CL.late_bloomer, 'write_your_own_ending', s.turn)).toBe(true);
    for (const id of Object.keys(getLibrary().classes)) expect(p.core.classes.some((c) => c.classId === id), id).toBe(true);
    expect(p.core.perks.map((x) => x.perkId)).toEqual(['write_your_own_ending']);
  });

  it('No Road Closed: a tree the owner is barred from opens', () => {
    const s = makeVillage(), p = s.player;
    expect(treeOpen(p, 'natural')).toBe(false); // needs an amorphous body or the dragon race
    give(p, 'no_road_closed');
    expect(treeOpen(p, 'natural')).toBe(true);
  });
});
