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
import { baneSkill, chainRollLine } from '../../src/ruleset/bane';
import { getLibrary } from '../../src/library';
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
  it('BG-256: each level adds its own growing step to the steps below it: I = +5, II = +5 + 10 = +15, III = +5 + 10 + 15 = +30', () => {
    expect([baneSkill(ACH.first_defeat_race), baneSkill(ACH.defeats_10_race), baneSkill(ACH.defeats_100_race)]).toEqual([5, 15, 30]);
    expect([baneSkill(ACH.first_defeat_body_type), baneSkill(ACH.defeats_10_body_type), baneSkill(ACH.defeats_100_body_type)]).toEqual([5, 15, 30]); // Scourge of the {body_type} Hordes: +15 on rolls
  });
  it('BG-256: the shown reward is the total with each level\'s own part', () => {
    const a = getLibrary().achievements!;
    expect(chainRollLine(ACH.defeats_100_body_type, a[ACH.defeats_100_body_type])).toBe('+15 on rolls vs that body type (+2.5 + +5 + +7.5)');
    expect(chainRollLine(ACH.first_defeat_race, a[ACH.first_defeat_race])).toBe('+2.5 on rolls vs that race');
    expect(chainRollLine(ACH.defeats_250, a[ACH.defeats_250])).toBe('+10 on every attack and defense roll (+1 + +2 + +3 + +4)');
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
    expect(bane(s, 'patron_1')).toEqual([{ source: 'bane: Bane of Humankind', type: 'achievement', value: 7.5 }]);
  });
  it('the best race and best body type both count, the weaker by the stacking rule; defenders get it too', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    grantAchievement(s, ACH.first_defeat_race, RC.human); // +5 skill
    grantAchievement(s, ACH.first_defeat_body_type, BT.humanoid);
    grantAchievement(s, ACH.defeats_10_body_type, BT.humanoid); // +15 skill
    const mods = bane(s, 'patron_1');
    expect(mods.map((m) => m.value).sort()).toEqual([2.5, 7.5]);
    expect(modTotal(mods)).toBeCloseTo(7.5 + 2.5 * stackWeight(2, CONFIG.MOD_STACK_EXP)); // RN2: the second at √2 − 1
    arm(s, 'patron_1');
    const d = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 50, 50, 50]));
    expect(modTotal(d.defense!.modifiers.filter((m) => m.type === 'achievement'))).toBeCloseTo(7.5 + 2.5 * stackWeight(2, CONFIG.MOD_STACK_EXP));
  });
});
