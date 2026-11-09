// 129 D-119: total-defeats achievements add +1 per tier (I = +1, II = +2, III = +3) to every attack and
// defense roll. Only the highest earned level counts; it stacks with Bane bonuses as one modifier type.
import { ACH } from '../../src/library/achievementIds';
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { modTotal, ruleset } from '../../src/ruleset';
import { grantAchievement } from '../../src/engine';
import { defeatsRoll } from '../../src/ruleset/bane';
import type { GameState } from '../../src/types';

const arm = (s: GameState, id: string) => {
  const a = id === 'player' ? s.player : s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId: 'dagger', equippedIn: ['hand:right_arm'] });
};
const fight = (s: GameState) => {
  place(s, 'patron_1', s.player.zone);
  arm(s, 'player');
  arm(s, 'patron_1');
  const atk = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'w_player', targetPart: null, aimed: false }, s, forcedRng([99, 50, 50, 50])).attack;
  const def = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 50, 50, 50])).defense!;
  const ach = (r: typeof atk) => r.modifiers.filter((m) => m.type === 'achievement');
  return { atk: ach(atk), def: ach(def) };
};

describe('129 total-defeats roll bonus', () => {
  it('tiers add up: I = +1, II = +2, III = +3, IV = +4', () => {
    expect([defeatsRoll(ACH.defeats_10), defeatsRoll(ACH.defeats_100), defeatsRoll(ACH.defeats_250), defeatsRoll(ACH.defeats_1000)]).toEqual([1, 2, 3, 4]);
  });
  it('no achievement, no bonus', () => {
    expect(fight(makeVillage())).toEqual({ atk: [], def: [] });
  });
  it('the highest level counts on attack and defense rolls; other rolls get nothing', () => {
    const s = makeVillage();
    grantAchievement(s, ACH.defeats_10);
    grantAchievement(s, ACH.defeats_100);
    const m = [{ source: `achievement: ${ACH.defeats_100}`, type: 'achievement', value: 2 }];
    expect(fight(s)).toEqual({ atk: m, def: m });
    const look = ruleset.roll({ actorId: 'player', skill: '14', modifiers: [], tierShifts: [], rollKind: 'perception' }, s, forcedRng([50]));
    expect(look.modifiers.filter((x) => x.type === 'achievement')).toEqual([]);
  });
  it('stacks with a Bane bonus as one modifier type: the weaker counts at half', () => {
    const s = makeVillage();
    grantAchievement(s, ACH.defeats_10); // +1
    grantAchievement(s, ACH.first_defeat_race, 'human'); // +5 skill = +2.5 on the roll
    expect(modTotal(fight(s).atk)).toBe(2.5 + 1 * 0.5);
  });
});
