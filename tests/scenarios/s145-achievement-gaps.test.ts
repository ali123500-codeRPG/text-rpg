// 145 achievement gaps found by checking every row: tree mastery at 50/100/150 for every tree (bundle or not),
// {class} Awakened for every class unlock however it happens, and Won Without a Blow for a fight won without attacking.
import { describe, expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { grantAllSteps } from '../../src/ruleset/allSteps';
import { awardXp, unlockClasses } from '../../src/engine/xp';
import { fightEnded } from '../../src/engine/feats';
import { getLibrary } from '../../src/library';
import { ACH, MASTERY_ACH } from '../../src/library/achievementIds';
import { CL } from '../../src/library/classIds';
import { PK } from '../../src/library/perkIds';
import { TR } from '../../src/library/treeIds';
import type { GameEvent, GameState } from '../../src/types';

const held = (s: GameState, key: string) => (s.player.progression?.achievements ?? []).filter((a) => a.key === key);
const strike = (s: GameState): GameEvent =>
  ({ id: 'e', turn: s.turn, actorId: 'player', kind: 'attack', zone: s.player.zone, effects: [], attack: { attackerId: 'player', targetId: 'slime_1', damage: 0, outcome: 'miss' } } as unknown as GameEvent);

describe('145 achievement gaps', () => {
  it('a tree with no All-50 bundle earns Adept, and every tree climbs to Ascendant and Transcendent', () => {
    for (const [treeId, raw] of [[TR.armor, 50], [TR.melee, 150]] as const) {
      const s = makeVillage();
      for (const sk of getLibrary().trees[treeId].skills) s.player.core.skills[sk] = { raw, state: 'normal' };
      grantAllSteps(s, s.player);
      const steps = Object.entries(MASTERY_ACH).filter(([n]) => Number(n) <= raw).map(([, k]) => k);
      for (const k of steps) expect(held(s, k).map((a) => a.of), `${treeId} ${k}`).toEqual([treeId]);
      if (raw === 150) { // only the top level is current
        expect(held(s, ACH.mastery_50)[0].replacedBy).toBeDefined();
        expect(held(s, ACH.mastery_150)[0].replacedBy).toBeUndefined();
      }
    }
  });

  it('{class} Awakened: classes opened by Write Your Own Ending and the default class at the top level count', () => {
    const s = makeVillage();
    s.player.core.perks.push({ perkId: PK.write_your_own_ending, source: 'class', gainedTurn: 0 });
    const had = s.player.core.classes.map((c) => c.classId);
    unlockClasses(s);
    const opened = s.player.core.classes.map((c) => c.classId).filter((c) => !had.includes(c));
    expect(opened.length).toBeGreaterThan(0);
    expect(held(s, ACH.class_unlock).map((a) => a.of).sort()).toEqual([...opened].sort());
    const t = makeVillage();
    awardXp(t, 1e6, 'test'); // Swordsman to its top level opens Commoner
    expect(held(t, ACH.class_unlock).map((a) => a.of)).toContain(CL.commoner);
  });

  it('Won Without a Blow: a fight won with no attack of your own, the last turn included', () => {
    const s = makeVillage();
    actor(s, 'slime_1').core.condition.hpLostPct = 150;
    fightEnded(s, { hp: 0, foes: ['slime_1'], most: 1, helped: true });
    expect(held(s, ACH.no_blow_1)).toHaveLength(1);
    fightEnded(s, { hp: 0, foes: ['slime_1'], most: 1, struck: true });
    fightEnded(s, { hp: 0, foes: ['slime_1'], most: 1 }, [strike(s)]); // the finishing turn's swing counts as a blow
    fightEnded(s, { hp: 0, foes: [], most: 0 }); // no foes: no fight to win
    expect(s.player.progression!.tally!.won_without_blow).toBe(1);
  });
});
