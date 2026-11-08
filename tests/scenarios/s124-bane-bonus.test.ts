// 124 D-111 Bane bonuses (Ali, 08/11/2026): an achievement earned against a race or body type gives +5 skill × its tier
// (I = 1, II = 2, III = 3) on rolls against that race or type; only the best one counts.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import { grantAchievement } from '../../src/engine';
import type { GameState } from '../../src/types';

const arm = (s: GameState, id: string) => {
  const a = id === 'player' ? s.player : s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId: 'dagger', equippedIn: ['hand:right_arm'] });
};
const bane = (s: GameState, target: string) => {
  arm(s, 'player');
  const r = ruleset.attack({ attackerId: 'player', targetId: target, weaponId: 'w_player', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
  return r.attack.modifiers.filter((m) => m.type === 'achievement');
};

describe('124 Bane bonuses', () => {
  it('no achievement, no bonus', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    expect(bane(s, 'patron_1')).toEqual([]);
  });
  it('a tier II race achievement gives +10 skill (+5 on the roll) against that race only', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    grantAchievement(s, 'defeats_10_race', 'elf');
    expect(bane(s, 'patron_1')).toEqual([]);
    grantAchievement(s, 'defeats_10_race', 'human');
    expect(bane(s, 'patron_1')).toEqual([{ source: 'bane: defeats_10_race:human', type: 'achievement', value: 5 }]);
  });
  it('the best matching achievement counts, race or body type, and defenders get it too', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    grantAchievement(s, 'first_defeat_race', 'human'); // I
    grantAchievement(s, 'defeats_100_body_type', 'humanoid'); // III
    expect(bane(s, 'patron_1').map((m) => m.value)).toEqual([7.5]);
    arm(s, 'patron_1');
    const d = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 50, 50, 50]));
    expect(d.defense?.modifiers.filter((m) => m.type === 'achievement').map((m) => m.value)).toEqual([7.5]);
  });
});
