// 159 Battle Cry (C2, I9; Intimidation 140): a perk move that is the turn's main action, once per engagement, aimed at
// no one. The roar is Loud and reaches everyone who perceives it at any level, however far. Each foe (opposed or hostile)
// rolls Resolve against the owner's Intimidation and loses 10 morale per tier when it loses; each ally gets 10 morale
// back and loses any Shaken. Since TC43 a the morale back comes from a rally roll (see s367).
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { maxMorale, moraleLost } from '../../src/ruleset/morale';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const cry = intent({ perkMove: { perk: PK.battle_cry, target: null } } as never);
/** the player owns Battle Cry; patron_1 is an opposed foe beside them; the trader is a friend, Shaken and down 30 morale */
const setup = () => {
  const s = makeVillage();
  give(s.player, PK.battle_cry);
  s.player.core.skills[SK.intimidation] = { raw: 140, state: 'normal' };
  const foe = npc(s, 'patron_1');
  place(s, 'patron_1', s.player.zone);
  foe.mind!.overrides = { player: 'opposed' };
  const friend = npc(s, 'trader');
  friend.mind!.overrides = { player: 'friend' };
  friend.pressure = { guard_1: { shaken: 10 } };
  friend.core.condition.moraleLost = 30;
  return { s, foe, friend };
};

describe('159 Battle Cry', () => {

  it('foes who hear it roll Resolve against Intimidation; allies take heart; it takes 1 s and the attack follows (AT11)', () => {
    const { s, foe, friend } = setup();
    const before = moraleLost(foe);
    const ev = play(s, { intent: { ...cry, action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '' } } as never });
    const roar = ev.find((e) => e.kind === 'battle_cry' && e.actorId === 'player')!;
    expect(roar.noise).toBe('loud');
    const onFoe = roar.effects.find((f) => f.actorId === 'patron_1')!;
    expect(['cry_took', 'cry_resisted']).toContain(onFoe.kind);
    if (onFoe.kind === 'cry_took') expect(moraleLost(foe)).toBeGreaterThan(before);
    expect(roar.effects.find((f) => f.actorId === 'trader')?.kind).toBe('rallied');
    expect(roar.effects.find((f) => f.actorId === 'player')?.kind).toBe('rallied'); // the roarer takes heart too
    expect(friend.pressure?.guard_1?.shaken).toBeUndefined();
    const back = 30 - moraleLost(friend); // TC43 a: 10 per tier above Near Miss of the friend's rally roll, plus a little natural recovery
    expect(Math.round(back) % 10).toBe(0);
    expect(back).toBeGreaterThanOrEqual(0);
    expect(ev.findIndex((e) => e.kind === 'battle_cry')).toBeLessThan(ev.findIndex((e) => e.kind === 'attack' && e.actorId === 'player')); // 1 s roar, then the blow
  });

  it('can be let out while broken: a broken nerve keeps the roar and still blocks the attack (BF37)', () => {
    const { s } = setup();
    s.player.core.condition.moraleLost = maxMorale(s.player); // broken
    const ev = play(s, { intent: { ...cry, action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '' } } as never });
    expect(ev.some((e) => e.kind === 'battle_cry' && e.actorId === 'player')).toBe(true);
    expect(ev.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(false);
  });
});
