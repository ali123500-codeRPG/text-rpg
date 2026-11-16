// 337 Rewards for XP-only achievements, round 2 (XR3 b, XR7 a, XR19 a, XR28 a, XR37 a): Touched by Fate opens one band
// past Critical Success on every roll; clean defenses add +1, +2, +3, +4 on defense rolls (+10 at the top); speech wins
// add +2 true skill to that speech skill per level from 10; Not Done Yet +5 max morale; the spotted trunk gains a 250 row
// and adds +1 then +2 more on spotting rolls. Amounts add up along the chain.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';
import { grantAchievement } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import { achievementMaxMorale, achievementRollMods, achievementSkill, rewardLines, tierReach } from '../../src/ruleset/achRewards';
import type { AchievementDef, GameState } from '../../src/types';

const L = () => getLibrary().achievements! as Record<string, AchievementDef>;
const give = (s: GameState, ...keys: string[]) => { for (const k of keys) grantAchievement(s, k, undefined, undefined, true); };
const giveOf = (s: GameState, of: string, ...keys: string[]) => { for (const k of keys) grantAchievement(s, k, of, undefined, true); };
const val = (m: { value: number }[]) => m.reduce((n, x) => n + x.value, 0);

describe('337 XP-only rewards, round 2', () => {
  it('XR3 b: only Touched by Fate (level III) opens one band past Critical Success on every roll', () => {
    const s = makeVillage();
    give(s, ACH.beyond_1, ACH.beyond_2);
    expect(tierReach(s.player, undefined).up).toBe(0);
    give(s, ACH.beyond_3);
    expect(tierReach(s.player, undefined).up).toBe(1);
    expect(tierReach(s.player, 'hit').up).toBe(1);
  });

  it('XR7 a: clean defenses add +1, +2, +3, +4 on dodge, block and parry rolls only (+10 at the top)', () => {
    const s = makeVillage();
    give(s, ACH.clean_1);
    expect(val(achievementRollMods(s.player, 'dodge'))).toBe(1);
    give(s, ACH.clean_10, ACH.clean_100, ACH.clean_500);
    for (const k of ['dodge', 'block', 'parry'] as const) expect(val(achievementRollMods(s.player, k))).toBe(10);
    expect(achievementRollMods(s.player, 'hit')).toEqual([]);
    expect(rewardLines(L()[ACH.clean_500])[0]).toMatch(/^\+10 on your defense rolls .* in all \(\+1 from Turned Aside, \+2 from Not Here, \+3 from Wall of Steel, \+4 here\)$/);
  });

  it('XR7: the bonus reaches a real defense roll as an achievement modifier', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    const foe = s.actors.find((a) => a.id === 'patron_1')!;
    for (const i of foe.core.inventory) delete i.equippedIn;
    foe.core.inventory.push({ id: 'w_foe', itemId: IT.dagger, equippedIn: ['grip:right_arm'] });
    give(s, ACH.clean_1, ACH.clean_10);
    const d = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_foe', targetPart: null, aimed: false }, s, forcedRng([99, 50, 50, 50])).defense!;
    expect(d.modifiers.filter((m) => m.type === 'achievement')).toEqual([{ source: 'achievement: Not Here', type: 'achievement', value: 3 }]);
  });

  it('XR37 a: the spotted trunk gains a 250 row; +1 at 100, +2 more at 250, on sight, hearing and smell rolls only', () => {
    expect(L()[ACH.spotted_250]).toMatchObject({ count: 250, after: ACH.spotted_100, rule: 'spotted' });
    const s = makeVillage();
    give(s, ACH.spotted_10);
    expect(achievementRollMods(s.player, 'perception', FN.sight)).toEqual([]);
    give(s, ACH.spotted_100);
    expect(val(achievementRollMods(s.player, 'perception', FN.hearing))).toBe(1);
    give(s, ACH.spotted_250);
    for (const fn of [FN.sight, FN.hearing, FN.smell]) expect(val(achievementRollMods(s.player, 'perception', fn))).toBe(3);
    expect(achievementRollMods(s.player, 'perception')).toEqual([]); // a perception roll with no sense named is not spotting
  });

  it('XR19 a: speech wins add +2 true skill to that speech skill per level from 10 (+6 at 250)', () => {
    const s = makeVillage();
    giveOf(s, SK.persuasion, ACH.speech_1);
    expect(achievementSkill(s.player, SK.persuasion)).toBe(0);
    giveOf(s, SK.persuasion, ACH.speech_10, ACH.speech_100, ACH.speech_250);
    expect(achievementSkill(s.player, SK.persuasion)).toBe(6);
    expect(achievementSkill(s.player, SK.lying)).toBe(0);
  });

  it('XR28 a: Not Done Yet adds +5 max morale', () => {
    const s = makeVillage();
    const before = achievementMaxMorale(s.player);
    give(s, ACH.back_from_down_1);
    expect(achievementMaxMorale(s.player)).toBe(before + 5);
  });
});
