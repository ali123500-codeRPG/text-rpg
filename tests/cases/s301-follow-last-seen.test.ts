// BG-203 (BF28): "follow the lean man" when he had slipped out of sight walked to "the spot where you last saw them", and
// the story then had him standing there as if someone new. The walk names whom it was, the Narrator is told anyone like
// him there is him, and the follow stays a follow: seen or heard on the way, the next turns keep after him.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { intent, play } from './w4-kit';
import type { GameState } from '../../src/types';

function slippedOff(): GameState {
  const s = makeVillage({ shape: { tav_common: { rect: { x: 0, y: 0, w: 12, d: 8 } } }, without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common'; s.player.pos = { x: -5, y: 0 };
  w.pos = { x: 4, y: 3 };
  play(s, { intent: intent({ action: { type: 'observe', target: null } }) }); // the player sees him there
  w.posture = 'stealthy'; w.pos = { x: 4, y: -3 }; delete s.player.journal!.clearSight!.patron_1; // he slips off unseen
  return s;
}
const followHim = (s: GameState) => {
  const r = checkParserLegality({ ...intent({ move: { toZone: 'tav_common', spot: { near: 'patron_1', follow: true } } }), action: null }, buildPlayerView(s));
  expect(r.intent.move!.spot).toMatchObject({ near: 'patron_1', follow: true, lastSeen: true });
  return r.intent;
};

describe('BG-203 following someone last seen', () => {
  it('seen on the way, the follow carries on after him', () => {
    const s = slippedOff();
    const w = s.actors.find((a) => a.id === 'patron_1')!;
    const go = followHim(s);
    w.posture = 'open'; // he steps back out where he can be seen as the player sets off
    play(s, { intent: go });
    expect(s.player.walking?.spot).toEqual({ near: 'patron_1', follow: true });
    expect(buildPlayerView(s).player.following).toMatchObject({ who: 'patron_1' });
    expect(buildPlayerView(s).player.following?.lost).toBeUndefined();
  });
});
