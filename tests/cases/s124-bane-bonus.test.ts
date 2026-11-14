// 124 D-111 Bane bonuses: an achievement earned against a race or body type gives the lower level's bonus
// plus +5 skill (I = +5, II = +10, III = +15) on rolls against that race or type. A higher level switches
// the lower ones off. The best race one and the best body type one both count, the weaker at half (type stacking).
import { CONFIG } from '../../src/config';
import { stackWeight } from '../../src/ruleset/stacking';
import { BT, RC } from '../../src/library/raceIds';
import { ACH } from '../../src/library/achievementIds';
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { modTotal, ruleset } from '../../src/ruleset';
import { grantAchievement } from '../../src/engine';
import { baneSkill } from '../../src/ruleset/bane';
import type { GameState } from '../../src/types';
import { IT } from '../../src/library/itemIds';

const arm = (s: GameState, id: string) => {
  const a = id === 'player' ? s.player : s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId: IT.dagger, equippedIn: ['grip:right_arm'] });
};
const bane = (s: GameState, target: string) => {
  arm(s, 'player');
  const r = ruleset.attack({ attackerId: 'player', targetId: target, weaponId: 'w_player', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
  return r.attack.modifiers.filter((m) => m.type === 'achievement');
};

describe('124 Bane bonuses', () => {
  it('linked levels add up: I = +5, II = +10, III = +15', () => {
    expect([baneSkill(ACH.first_defeat_race), baneSkill(ACH.defeats_10_race), baneSkill(ACH.defeats_100_race)]).toEqual([5, 10, 15]);
    expect([baneSkill(ACH.first_defeat_body_type), baneSkill(ACH.defeats_10_body_type), baneSkill(ACH.defeats_100_body_type)]).toEqual([5, 10, 15]);
  });
  it('no achievement, no bonus', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    expect(bane(s, 'patron_1')).toEqual([]);
  });
  it('a higher level switches the lower off; only it is checked, and only against that race', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    grantAchievement(s, ACH.defeats_10_race, RC.elf);
    expect(bane(s, 'patron_1')).toEqual([]);
    grantAchievement(s, ACH.first_defeat_race, RC.human);
    grantAchievement(s, ACH.defeats_10_race, RC.human);
    const earned = s.player.progression!.achievements!;
    expect(earned.find((a) => a.id === `${ACH.first_defeat_race}:${RC.human}`)?.replacedBy).toBe(`${ACH.defeats_10_race}:${RC.human}`);
    expect(earned.find((a) => a.id === `${ACH.defeats_10_race}:${RC.elf}`)?.replacedBy).toBeUndefined();
    expect(bane(s, 'patron_1')).toEqual([{ source: 'bane: Bane of Humankind', type: 'achievement', value: 5 }]);
  });
  it('the best race and best body type both count, the weaker by the stacking rule; defenders get it too', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    grantAchievement(s, ACH.first_defeat_race, RC.human); // +5 skill
    grantAchievement(s, ACH.first_defeat_body_type, BT.humanoid);
    grantAchievement(s, ACH.defeats_10_body_type, BT.humanoid); // +10 skill
    const mods = bane(s, 'patron_1');
    expect(mods.map((m) => m.value).sort()).toEqual([2.5, 5]);
    expect(modTotal(mods)).toBeCloseTo(5 + 2.5 * stackWeight(2, CONFIG.MOD_STACK_EXP)); // RN2: the second at √2 − 1
    arm(s, 'patron_1');
    const d = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 50, 50, 50]));
    expect(modTotal(d.defense!.modifiers.filter((m) => m.type === 'achievement'))).toBeCloseTo(5 + 2.5 * stackWeight(2, CONFIG.MOD_STACK_EXP));
  });
});
