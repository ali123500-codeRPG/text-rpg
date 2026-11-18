// 371 Tactics learning (TC6 a, TC6 b, TC15 a; D-132 closed): the player's reaction roll at a fight's start marks Battle
// Sense against the best foe's Reaction skill; a fight the player survives marks each Tactics skill against the strongest
// foe's same skill. A foe untrained in the skill never teaches, and the learning window holds as for every skill.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { markFightSurvived, markReaction } from '../../src/engine/tacticsMarks';
import { fightEnded } from '../../src/engine/feats';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameState } from '../../src/types';

const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
const marks = (s: GameState, id: string) => s.player.progression?.markCounts?.[id] ?? 0;
/** the guard fights the player */
const fight = () => {
  const s = makeVillage();
  const g = place(s, 'guard_1', s.player.zone);
  g.mind!.overrides = { player: 'hostile' };
  g.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
  for (const id of [SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem]) skill(s.player, id, 30);
  return { s, g };
};

describe('371 Tactics learning', () => {
  it('TC6 a: the reaction roll marks Battle Sense against a foe inside its window, never an untrained one', () => {
    const { s, g } = fight();
    skill(g, SK.battle_sense, 35);
    markReaction(s, s.player);
    expect(marks(s, SK.battle_sense)).toBe(1);
    skill(g, SK.battle_sense, 0);
    markReaction(s, s.player);
    expect(marks(s, SK.battle_sense)).toBe(1);
    skill(g, SK.battle_sense, 60); // too strong to learn from
    markReaction(s, s.player);
    expect(marks(s, SK.battle_sense)).toBe(1);
    markReaction(s, g); // NPCs do not learn
    expect(g.progression?.markCounts?.[SK.battle_sense] ?? 0).toBe(0);
  });

  it('TC6 b, TC15 a: a fight survived marks each Tactics skill the strongest foe has near the player', () => {
    const { s, g } = fight();
    skill(g, SK.battle_sense, 35); skill(g, SK.command, 0); skill(g, SK.fieldcraft, 25); skill(g, SK.stratagem, 90);
    markFightSurvived(s, { hp: 0, foes: [g.id], most: 1 });
    expect([SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem].map((id) => marks(s, id))).toEqual([1, 0, 1, 0]);
  });

  it('a fight ended through fightEnded marks too; one the player went Down in does not', () => {
    const { s, g } = fight();
    skill(g, SK.battle_sense, 35);
    fightEnded(s, { hp: 0, foes: [g.id], most: 1 });
    expect(marks(s, SK.battle_sense)).toBe(1);
    s.player.core.condition.hpLostPct = 100;
    markFightSurvived(s, { hp: 100, foes: [g.id], most: 1, down: true });
    expect(marks(s, SK.battle_sense)).toBe(1);
  });
});
