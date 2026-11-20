// AD8/AD10: the action deck lists every action the game knows (a Parser action, a gear order or a door order), each as one
// entry; AD9: the suggestion is scored by code with a reason; AD12: a move planned on the minimap rides along with an action.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import type { GameState } from '../../src/types';
import { deck } from '../../src/ui/deck';
import { withPlanned } from '../../src/ui/deckView';


const fight = (s: GameState = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] })) => {
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.mode = 'tactical';
  return s;
};

describe('the action deck covers everything (AD10: "make sure you covered EVERYTHING")', () => {

  it('with Aim on, an attack asks for a body part after whom, and the order carries it aimed (AD5)', () => {
    const s = fight();
    const pv = buildPlayerView(s);
    const atk = deck({ pv, s, aim: true }).flatMap((g) => g.actions).find((a) => a.kind === 'attack')!;
    expect(atk.steps.map((x) => x.key).slice(0, 2)).toEqual(['target', 'part']);
    const part = atk.steps[1].key === 'part' ? atk.steps[1].picks({ target: 'patron_1' })[0].id : '';
    expect(atk.play({ target: 'patron_1', part }).intent.action).toMatchObject({ type: 'attack', target: 'patron_1', targetPart: part, aimed: true });
    expect(deck({ pv, s }).flatMap((g) => g.actions).find((a) => a.kind === 'attack')!.steps.some((x) => x.key === 'part')).toBe(false);
  });

});

describe('a move planned on the minimap (AD12)', () => {
  const p = { zone: 'tav_common', x: 3, y: 4, metres: 5, seconds: 3, turns: 1, label: 'the common room, 5 m' };
  it('rides along with an action, the move first in the line', () => {
    const o = withPlanned({ line: 'Look around', intent: { move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null } }, p);
    expect(o.intent.move).toEqual({ toZone: 'tav_common', spot: { at: { x: 3, y: 4 } } });
    expect(o.line).toBe('Move to the common room, then look around');
  });
});
