// 159 Battle Cry (C2, I9; Intimidation 140): a perk move that is the turn's main action, once per engagement, aimed at
// no one. The roar is Loud and reaches everyone who perceives it at any level, however far. Each foe (opposed or hostile)
// rolls Resolve against the owner's Intimidation and loses 10 morale per tier when it loses; each ally gets 10 morale
// back and loses any Shaken.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PERK_MOVES } from '../../src/ruleset/perks';
import { perkMoveBlock } from '../../src/engine/perkMoves';
import { moraleLost } from '../../src/ruleset/morale';
import { buildPlayerView } from '../../src/views';
import { ideas } from '../../src/ui/play';
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
  it('is the Intimidation 140 perk, built, and a main-action move aimed at no one', () => {
    expect(getLibrary().perks[PK.battle_cry]?.ladder).toEqual({ skill: SK.intimidation, milestone: 140 });
    expect(BUILT_PERKS.has(PK.battle_cry)).toBe(true);
    expect(PERK_MOVES[PK.battle_cry]).toMatchObject({ free: false, perEngagement: 1, untargeted: true });
  });

  it('needs no target, shows as an action in the Parser view and in Ideas', () => {
    const { s } = setup();
    expect(perkMoveBlock(s, s.player, PK.battle_cry, null)).toBeNull();
    const pv = buildPlayerView(s);
    expect(pv.player.perkMoves?.find((m) => m.id === PK.battle_cry)).toMatchObject({ name: 'Battle Cry', action: true });
    expect(ideas(pv).find((g) => g.group === 'Perks')?.items.some((i) => i.text === 'Let out a battle cry')).toBe(true);
  });

  it('foes who hear it roll Resolve against Intimidation; allies take heart; it takes the main action', () => {
    const { s, foe, friend } = setup();
    const before = moraleLost(foe);
    const ev = play(s, { intent: { ...cry, action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } } as never });
    const roar = ev.find((e) => e.kind === 'battle_cry' && e.actorId === 'player')!;
    expect(roar.noise).toBe('loud');
    const onFoe = roar.effects.find((f) => f.actorId === 'patron_1')!;
    expect(['cry_took', 'cry_resisted']).toContain(onFoe.kind);
    if (onFoe.kind === 'cry_took') expect(moraleLost(foe)).toBeGreaterThan(before);
    expect(roar.effects.find((f) => f.actorId === 'trader')?.kind).toBe('rallied');
    expect(roar.effects.find((f) => f.actorId === 'player')?.kind).toBe('rallied'); // the roarer takes heart too
    expect(friend.pressure?.guard_1?.shaken).toBeUndefined();
    expect(moraleLost(friend)).toBeCloseTo(20, 0); // 10 back, and a little natural recovery as the clock moves
    expect(ev.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(false); // the roar was the action
  });

  it('once per engagement', () => {
    const { s } = setup();
    play(s, { intent: cry });
    expect(perkMoveBlock(s, s.player, PK.battle_cry, null)).toBe('used_this_engagement');
    const ev = play(s, { intent: cry });
    expect(ev.some((e) => e.kind === 'battle_cry')).toBe(false);
    expect(s.log.some((l) => l.code === 'perk_move_dropped')).toBe(true);
  });
  it('the roar rallies the one who roars: 10 morale back and any Shaken gone, untold in narration', () => {
    const { s } = setup();
    s.player.core.condition.moraleLost = 30;
    s.player.pressure = { patron_1: { shaken: 10 } };
    play(s, { intent: cry });
    expect(moraleLost(s.player)).toBeCloseTo(20, 0);
    expect(s.player.pressure?.patron_1?.shaken).toBeUndefined();
  });
});
