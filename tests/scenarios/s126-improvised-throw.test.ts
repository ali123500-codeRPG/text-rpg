// 126 Improvised weapons strike or throw (Ali, 09/11/2026): both modes roll Improvisation; Unarmed skills stand in
// for both, Arms skills also for the strike, Ranged skills also for the throw.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import { itemDef } from '../../src/library';
import type { GameState } from '../../src/types';
import { SK } from '../../src/library/skillIds';

const holdImprovised = (s: GameState) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'vase', itemId: 'improvised_light', equippedIn: ['hand:right_arm'] } as never);
};
const setSkills = (s: GameState, raw: Record<string, number>) => {
  for (const k of [SK.unarmed_improvised, SK.unarmed_strike, SK.unarmed_grapple, SK.melee_light, SK.melee_medium, SK.melee_heavy, SK.ranged_light, SK.ranged_medium, SK.ranged_heavy])
    s.player.core.skills[k] = { raw: raw[k] ?? 0, state: 'normal' };
};

describe('126 improvised strike and throw', () => {
  it('every improvised base has a melee strike and a ranged throw, both on Improvisation', () => {
    const s = makeVillage();
    for (const id of ['improvised_light', 'improvised_medium', 'improvised_heavy']) {
      const modes = itemDef(s, id).weapon!.modes;
      expect(modes.map((m) => [m.id, m.tree, m.skill])).toEqual([['strike', 'melee', SK.unarmed_improvised], ['throw', 'ranged', SK.unarmed_improvised]]);
      expect(modes[1].thrown).toBe(true);
    }
  });
  it('a throw at a foe one zone away: a Ranged skill stands in, an Arms skill does not', () => {
    const s = makeVillage();
    holdImprovised(s);
    place(s, 'player', 'tav_common');
    place(s, 'patron_1', 'tav_counter');
    setSkills(s, { [SK.ranged_light]: 80, [SK.melee_medium]: 90 });
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'vase', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(r.modeId).toBe('throw');
    expect(r.attack.skill).toBe(SK.ranged_light);
    expect(r.attack.asked).toBe(SK.unarmed_improvised);
  });
  it('a strike in the same zone: an Arms skill stands in, a Ranged skill does not; Unarmed works for both', () => {
    const s = makeVillage();
    holdImprovised(s);
    place(s, 'player', 'tav_common');
    place(s, 'patron_1', 'tav_common');
    setSkills(s, { [SK.ranged_light]: 90, [SK.melee_medium]: 80 });
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'vase', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(r.modeId).toBe('strike');
    expect(r.attack.skill).toBe(SK.melee_medium);
    setSkills(s, { [SK.unarmed_strike]: 70, [SK.ranged_light]: 60 });
    const t = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'vase', modeId: 'throw', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(t.attack.skill).toBe(SK.unarmed_strike);
  });
});
