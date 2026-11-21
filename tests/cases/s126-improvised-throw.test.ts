// 126 Improvised weapons strike or throw: both modes roll Improvisation; Unarmed skills stand in
// for both, Arms skills also for the strike, Ranged skills also for the throw.
import { AM } from '../../src/library/tableIds';
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place, beside } from '../harness';
import { ruleset } from '../../src/ruleset';
import type { GameState } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

const holdImprovised = (s: GameState) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'vase', itemId: IT.improvised_light, equippedIn: ['grip:right_arm'] } as never);
};
const setSkills = (s: GameState, raw: Record<string, number>) => {
  for (const k of [SK.unarmed_improvised, SK.unarmed_strike, SK.unarmed_grapple, SK.melee_light, SK.melee_medium, SK.melee_heavy, SK.ranged_light, SK.ranged_medium, SK.ranged_heavy])
    s.player.core.skills[k] = { raw: raw[k] ?? 0, state: 'normal' };
};

describe('126 improvised strike and throw', () => {
  it('a throw: a Ranged skill stands in, an Arms skill does not', () => {
    const s = makeVillage();
    holdImprovised(s);
    place(s, 'player', 'tav_common');
    beside(s, 'patron_1');
    setSkills(s, { [SK.ranged_light]: 80, [SK.melee_medium]: 90 });
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'vase', modeId: AM.throw, targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(r.modeId).toBe(AM.throw);
    expect(r.attack.skill).toBe(SK.ranged_light);
    expect(r.attack.asked).toBe(SK.unarmed_improvised);
  });
});
