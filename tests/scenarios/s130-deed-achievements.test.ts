// 130 D-120 deed achievements: tallies per rule (counts, or the best reached), per group and per class; Critical
// Success and beyond on combat rolls; unaware and crippled defeats; and the fight achievements judged when a fight ends.
import { HL } from '../../src/library/tableIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { achievementName, payDefeats, rollFeats, tally, unlockClasses } from '../../src/engine/xp';
import { forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { fightEnded, turnFeats } from '../../src/engine/feats';
import { ACH } from '../../src/library/achievementIds';
import { GR } from '../../src/library/functionIds';
import { SK } from '../../src/library/skillIds';
import type { GameEvent, GameState } from '../../src/types';
import { isBane } from '../../src/ruleset/bane';
import { grantAchievement } from '../../src/engine/xp';
import { MOD_SOURCES } from '../../src/ruleset/modSources';
import { getLibrary } from '../../src/library';
import { CL } from '../../src/library/classIds';

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.id);

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
  it('Critical Success rolls of any skill count per skill group; steps past it count once in general and per group', () => {
    const s = makeVillage();
    for (let i = 0; i < 10; i++) rollFeats(s, { skill: SK.melee_light, tier: 'critical_success' });
    expect(earned(s)).toContain(`${ACH.crits_10}:${GR.melee}`);
    expect(achievementName(s, s.player.progression!.achievements!.find((a) => a.id === `${ACH.crits_10}:${GR.melee}`)!)).toBe('Sure Hand (Melee)');
    rollFeats(s, { skill: SK.melee_light, tier: 'great_success' });
    rollFeats(s, { skill: SK.dodge, tier: 'critical_success', beyond: 2 });
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.beyond_2, `${ACH.beyond_group_2}:${GR.defense}`]));
    expect(earned(s)).not.toContain(ACH.beyond_1); // replaced by Past the Limit
    // a non-combat roll counts too: a natural 100 on Persuasion reaches Critical Success or better
    ruleset.roll({ actorId: 'player', skill: SK.persuasion, modifiers: [], tierShifts: [] }, s, forcedRng([100]));
    expect(s.player.progression!.tally![`crits:group:${GR.influence}`]).toBe(1);
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
    s.player.core.classes = s.player.core.classes.filter((c) => c.classId !== CL.swordsman);
    s.player.core.skills[SK.melee_medium] = { raw: 40, state: 'normal' };
    s.player.core.skills[SK.parry] = { raw: 40, state: 'normal' };
    unlockClasses(s);
    unlockClasses(s);
    const a = s.player.progression!.achievements!.filter((x) => x.key === ACH.class_unlock);
    expect(a.map((x) => achievementName(s, x))).toEqual(['Swordsman Awakened']);
  });
  it('fight achievements: flawless needs a defense roll, outnumbered needs no allies, the brink counts once per fight', () => {
    const s = makeVillage();
    const foes = ['slime_1', 'slime_2', 'patron_1'];
    for (const id of foes) actor(s, id).core.condition.hpLostPct = 100; // all down: the fight is won
    fightEnded(s, { hp: 0, foes, most: 3, struck: true });
    expect(earned(s)).toEqual([ACH.outnumbered_1]); // no defense roll: not flawless
    fightEnded(s, { hp: 0, foes, most: 3, struck: true, defended: true, helped: true, brink: true });
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.flawless_1, ACH.brink_1]));
    expect(s.player.progression!.tally!.outnumbered).toBe(1); // helped: not counted
    actor(s, 'slime_1').core.condition.hpLostPct = 0; // a foe still up and hostile: not won
    fightEnded(s, { hp: 0, foes, most: 3, struck: true, defended: true, brink: true });
    expect(s.player.progression!.tally!.flawless).toBe(1);
    expect(s.player.progression!.tally!.brink).toBe(2); // surviving the brink counts win or not
  });
  it('only race and body type defeat chains are Banes: group and class chains give no skill bonus', () => {
    const lib = getLibrary().achievements ?? {};
    const banes = Object.keys(lib).filter((k) => isBane(lib[k]));
    expect(banes.sort()).toEqual([ACH.first_defeat_body_type, ACH.defeats_10_body_type, ACH.defeats_100_body_type,
      ACH.first_defeat_race, ACH.defeats_10_race, ACH.defeats_100_race].sort());
    const fed = MOD_SOURCES.find((m) => m.source.startsWith('Bane'))!.feeds!(getLibrary()).map((f) => f.id);
    expect(fed.sort()).toEqual(banes.sort());
  });
});
