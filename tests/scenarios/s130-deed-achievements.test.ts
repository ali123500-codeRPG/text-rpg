// 130 D-120 deed achievements: tallies per rule (counts, or the best reached), per group and per class; Critical
// Success and beyond on combat rolls; unaware and crippled defeats; and the fight achievements judged when a fight ends.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { achievementName, payDefeats, tally, unlockClasses } from '../../src/engine/xp';
import { fightEnded, turnFeats } from '../../src/engine/feats';
import { ACH } from '../../src/library/achievementIds';
import { GR } from '../../src/library/functionIds';
import { SK } from '../../src/library/skillIds';
import type { GameEvent, GameState } from '../../src/types';

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.id);
const playerRoll = (tier: string, beyond = 0, skill: string = SK.melee_light) =>
  ({ attack: { attackerId: 'player', targetId: 'x', attack: { tier, beyond, skill }, defense: null, damage: 0 } }) as unknown as GameEvent;

describe('130 deed achievements', () => {
  it('a tally grants each level it reaches; a higher level replaces the lower', () => {
    const s = makeVillage();
    tally(s, 'deals');
    expect(earned(s)).toEqual([ACH.deals_1]);
    for (let i = 0; i < 9; i++) tally(s, 'deals');
    expect(earned(s)).toEqual([ACH.deals_10]);
    tally(s, 'days', { to: 30 });
    tally(s, 'days', { to: 3 }); // a best value never goes down
    expect(s.player.progression!.tally!.days).toBe(30);
    expect(earned(s)).toContain(ACH.days_30);
  });
  it('Critical Success combat rolls count per skill group; steps past it count once in general and per group', () => {
    const s = makeVillage();
    for (let i = 0; i < 10; i++) turnFeats(s, [playerRoll('critical_success')]);
    expect(earned(s)).toContain(`${ACH.crits_10}:${GR.melee}`);
    expect(achievementName(s, s.player.progression!.achievements!.find((a) => a.id === `${ACH.crits_10}:${GR.melee}`)!)).toBe('Sure Hand (Melee)');
    turnFeats(s, [playerRoll('great_success'), playerRoll('critical_success', 2, SK.dodge)]);
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.beyond_2, `${ACH.beyond_group_2}:${GR.defense}`]));
    expect(earned(s)).not.toContain(ACH.beyond_1); // replaced by Past the Limit
  });
  it('zones entered count once each', () => {
    const s = makeVillage();
    turnFeats(s, []);
    turnFeats(s, []);
    expect(s.player.progression!.zonesSeen).toEqual([s.player.zone]);
    expect(s.player.progression!.tally!.zones).toBe(1);
  });
  it('a foe downed by an unaware hit, while one of your parts is crippled, counts for both', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    s.player.core.condition.parts.left_arm = -10; // Crippled
    slime.core.condition.hpLostPct = 100;
    payDefeats(s, [{ attack: { attackerId: 'player', targetId: 'slime_1', damage: 10, unaware: true } } as unknown as GameEvent]);
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.unaware_1, ACH.crippled_1]));
  });
  it('unlocking a class earns it once, named for the class', () => {
    const s = makeVillage();
    s.player.core.classes = s.player.core.classes.filter((c) => c.classId !== 'swordsman');
    s.player.core.skills[SK.melee_medium] = { raw: 40, state: 'normal' };
    s.player.core.skills[SK.block] = { raw: 40, state: 'normal' };
    unlockClasses(s);
    unlockClasses(s);
    const a = s.player.progression!.achievements!.filter((x) => x.key === ACH.class_unlock);
    expect(a.map((x) => achievementName(s, x))).toEqual(['Swordsman Awakened']);
  });
  it('fight achievements: flawless needs a defense roll, outnumbered needs no allies, the brink counts once per fight', () => {
    const s = makeVillage();
    const foes = ['slime_1', 'slime_2', 'patron_1'];
    for (const id of foes) actor(s, id).core.condition.hpLostPct = 100; // all down: the fight is won
    fightEnded(s, { hp: 0, foes, most: 3 });
    expect(earned(s)).toEqual([ACH.outnumbered_1]); // no defense roll: not flawless
    fightEnded(s, { hp: 0, foes, most: 3, defended: true, helped: true, brink: true });
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.flawless_1, ACH.brink_1]));
    expect(s.player.progression!.tally!.outnumbered).toBe(1); // helped: not counted
    actor(s, 'slime_1').core.condition.hpLostPct = 0; // a foe still up and hostile: not won
    fightEnded(s, { hp: 0, foes, most: 3, defended: true, brink: true });
    expect(s.player.progression!.tally!.flawless).toBe(1);
    expect(s.player.progression!.tally!.brink).toBe(2); // surviving the brink counts win or not
  });
});
