// 351 BF88: a threat needs no words. A beast that can't talk but has some wits (Semi-intelligent: a wolf, a bear) is stared
// down: the player's Intimidation against its own, and a win shakes it and costs it morale, as with a person. A mindless
// one (Unintelligent: a slime) ignores a threat, but a Battle Cry still shakes it like any foe.
import { describe, expect, it } from 'vitest';
import { actor, beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { spawnNpc } from '../../src/library/spawn';
import { TP } from '../../src/library/templateIds';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { moraleLost } from '../../src/ruleset/morale';
import type { GameState } from '../../src/types';

const withWolf = (seed: number) => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_2'] });
  s.turn = seed;
  s.bands.push({ ...s.bands.find((b) => b.id === 'slimes')!, id: 'wolves', name: 'the wolves', relations: {} });
  const w = spawnNpc(null, TP.wolf, { id: 'wolf_1', zone: s.player.zone, placeId: s.player.placeId, bandId: 'wolves', storyId: 'test' });
  s.actors.push(w);
  delete w.asleep;
  w.mind!.knowledge.player = { status: 'aware', lastKnownZone: s.player.zone, lastSeenTurn: 0, source: 'seen', revealed: [] }; // it sees the one threatening it
  beside(s, 'wolf_1', 'player', 2);
  beside(s, 'slime_1', 'player', 3);
  s.player.core.skills[SK.intimidation] = { raw: 200, state: 'normal' };
  return s;
};
const threaten = (s: GameState, target: string) => play(s, { intent: intent({ action: { type: 'intimidate', skill: SK.intimidation, target }, spoken: 'Back off!', addressees: [target] }) });

describe('351 threats at beasts', () => {
  it('a wolf is stared down: a contest, never "does not understand", and a win costs it morale', () => {
    let won = false;
    for (let seed = 1; seed < 12 && !won; seed++) {
      const s = withWolf(seed), w = actor(s, 'wolf_1');
      const ev = threaten(s, 'wolf_1').find((e) => e.actorId === 'player' && e.kind === 'speak')!;
      expect(ev.contest).toBeDefined();
      expect(ev.effects.some((f) => f.kind === 'not_understood' && f.actorId === 'wolf_1')).toBe(false);
      const took = ev.effects.find((f) => f.actorId === 'wolf_1' && (f.kind === 'threat_took' || f.kind === 'threat_shrugged'))!;
      expect(took).toBeDefined();
      if (took.kind === 'threat_took') { won = true; expect(moraleLost(w)).toBeGreaterThan(0); }
      else expect(moraleLost(w)).toBe(0);
    }
    expect(won).toBe(true);
  });

  it('a slime ignores a threat: no contest, the story says it does not understand; a Battle Cry still shakes it', () => {
    const s = withWolf(1);
    const said = threaten(s, 'slime_1').find((e) => e.actorId === 'player' && e.kind === 'speak')!;
    expect(said.contest).toBeUndefined();
    expect(said.effects.some((f) => f.kind === 'not_understood' && f.actorId === 'slime_1')).toBe(true);
    expect(moraleLost(actor(s, 'slime_1'))).toBe(0);
    s.player.core.perks.push({ perkId: PK.battle_cry, source: 'level', gainedTurn: 0 });
    s.player.core.skills[SK.intimidation] = { raw: 300, state: 'normal' };
    const ev = play(s, { intent: intent({ perkMove: { perk: PK.battle_cry, target: null } } as never) });
    expect(ev.flatMap((e) => e.effects).some((f) => f.kind === 'cry_took' && f.actorId === 'slime_1')).toBe(true);
    expect(moraleLost(actor(s, 'slime_1'))).toBeGreaterThan(0);
  });
});
