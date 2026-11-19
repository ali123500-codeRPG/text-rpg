// BG-265: in the deck playtest the suggestion read "Look around: Nothing presses" while three slimes in reach mauled the old
// reed-cutter: the suggestion (and Who's here) counted as foes only those the player can talk down or make yield, which a mute
// beast never is, and no one attacking someone else. Now the player view marks foe on one fighting the player (beasts too) and
// on one the player saw strike first at someone not fighting the player; a blow struck back makes no foe.
import { describe, expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import type { GameEvent, GameState } from '../../src/types';
import { deck } from '../../src/ui/deck';
import { suggestions } from '../../src/ui/suggest';

const blow = (s: GameState, n: number, from: string, to: string): GameEvent => ({ id: `ev_${n}`, turn: s.turn, actorId: from, kind: 'attack', zone: s.player.zone, target: to,
  effects: [], noise: 'normal', visibility: 'normal', perception: { player: { level: 'full', cue: 'sight' } } });
const village = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_2', 'guard_1', 'trader'] });
  beside(s, 'slime_1'); beside(s, 'patron_1', 'player', 1);
  s.mode = 'tactical';
  return s;
};
const sugOf = (s: GameState) => { const pv = buildPlayerView(s); return { pv, sug: suggestions(deck({ pv, s }), { pv, s })[0] }; };

describe('342 BG-265: a beast in a fight is a foe on the deck', () => {
  it('a slime fighting the player is a foe, and the suggestion is to attack it', () => {
    const s = village();
    actorById(s, 'slime_1')!.mind!.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const { pv, sug } = sugOf(s);
    expect(pv.actors.find((a) => a.id === 'slime_1')).toMatchObject({ foe: {} });
    expect(pv.actors.find((a) => a.id === 'slime_1')!.talkDown).toBeUndefined(); // the old test: a slime cannot be talked down
    expect(sug.action.kind).toBe('attack');
    expect(sug.choice.target).toBe('slime_1');
    expect(sug.reason).toMatch(/fighting you/);
  });

  it('a slime the player saw strike first at someone else is a foe; that one striking back is not', () => {
    const s = village();
    s.events = [blow(s, 1, 'slime_1', 'patron_1'), blow(s, 2, 'patron_1', 'slime_1')];
    const { pv, sug } = sugOf(s);
    expect(pv.actors.find((a) => a.id === 'slime_1')!.foe?.strikes).toBeTruthy();
    expect(pv.actors.find((a) => a.id === 'patron_1')!.foe).toBeUndefined();
    expect(sug.action.kind).toBe('attack');
    expect(sug.choice.target).toBe('slime_1');
    expect(sug.reason).toMatch(/is attacking/);
  });

  it('a blow the player did not see, or no fight at all, makes no foe; and with no foe a fight never reads "Nothing presses"', () => {
    const s = village();
    s.events = [{ ...blow(s, 1, 'slime_1', 'patron_1'), perception: {} }];
    const { pv, sug } = sugOf(s);
    expect(pv.actors.some((a) => a.foe)).toBe(false);
    expect(sug.reason).not.toMatch(/Nothing presses/);
    s.mode = 'explore';
    s.events = [blow(s, 1, 'slime_1', 'patron_1')];
    expect(buildPlayerView(s).actors.some((a) => a.foe)).toBe(false);
  });
});
