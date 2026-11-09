// When a stand-in makes the roll (decision "Both skills"), the stand-in and the skill the action
// asked for each get a mark, each against its own learning window (SP2), so a weak skill can still rise.
import { describe, expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { markUse } from '../../src/ruleset/improve';
import { SK } from '../../src/library/skillIds';

const req = (actorId: string, skill: string) => ({ actorId, skill, modifiers: [], tierShifts: [] });

describe('stand-in rolls teach both skills', () => {
  it('a light-weapon roll made by Medium melee marks Light melee when the foe is near its level', () => {
    const s = makeVillage(), p = s.player, t = actor(s, 'patron_1');
    p.core.skills[SK.melee_light] = { raw: 5, state: 'normal' };
    p.core.skills[SK.melee_medium] = { raw: 80, state: 'normal' };
    t.core.skills[SK.dodge] = { raw: 10, state: 'normal' };
    p.progression!.marks = [];
    const r = ruleset.contested(req(p.id, SK.melee_light), req(t.id, SK.dodge), s, createRng(3));
    expect(r.a.skill).toBe(SK.melee_medium);
    expect(r.a.asked).toBe(SK.melee_light);
    markUse(s, p, SK.melee_light, r);
    expect(p.progression!.marks).toEqual([SK.melee_light]); // 80 is far from 10, so Medium melee learns nothing here
  });
  it('the stand-in learns too when the foe is near its level', () => {
    const s = makeVillage(), p = s.player, t = actor(s, 'patron_1');
    p.core.skills[SK.melee_light] = { raw: 5, state: 'normal' };
    p.core.skills[SK.melee_medium] = { raw: 80, state: 'normal' };
    t.core.skills[SK.dodge] = { raw: 75, state: 'normal' };
    p.progression!.marks = [];
    markUse(s, p, SK.melee_light, ruleset.contested(req(p.id, SK.melee_light), req(t.id, SK.dodge), s, createRng(3)));
    expect(p.progression!.marks).toEqual([SK.melee_medium]);
  });
  it('a roll with no stand-in carries no asked skill', () => {
    const s = makeVillage();
    expect(ruleset.roll(req('player', SK.melee_medium), s, createRng(1)).asked).toBeUndefined();
  });
});
